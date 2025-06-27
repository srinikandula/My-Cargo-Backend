const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Vehicle = require('../models/Vehicle');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');

exports.getBranchReport = async (req, res) => {
  const { date, sortOrder = 'asc' } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const bookings = await Booking.find({
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled'] }  // exclude cancelled bookings
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .lean();

    const report = bookings.map(b => ({
      bookingDate: b.bookingDate,
      branchName: b.fromOffice?.name || '',
      bookingId: b.bookingId,
      lrType: b.lrType,
      status: b.status,
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      paymentType: b.paymentType || '',
      quantity: b.quantity || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.otherCharge || 0
    }));

    // Sort by branchName and then bookingDate
    const order = sortOrder === 'desc' ? -1 : 1;
    report.sort((a, b) => {
      const branchCompare = a.branchName.localeCompare(b.branchName);
      if (branchCompare !== 0) return branchCompare * order;
      return a.bookingDate.localeCompare(b.bookingDate) * order;
    });

    // Totals
    const totals = report.reduce((acc, r) => {
      acc.quantity += r.quantity;
      acc.freightCharge += r.freightCharge;
      acc.loadingCharge += r.loadingCharge;
      acc.unloadingCharge += r.unloadingCharge;
      acc.otherCharge += r.otherCharge;
      return acc;
    }, {
      quantity: 0,
      freightCharge: 0,
      loadingCharge: 0,
      unloadingCharge: 0,
      otherCharge: 0
    });

    // Add totals row
    report.push({
      bookingDate: '',
      branchName: '',
      bookingId: '',
      lrType: 'TOTAL',
      status: '',
      fromOffice: '',
      toOffice: '',
      paymentType: '',
      quantity: totals.quantity,
      freightCharge: totals.freightCharge,
      loadingCharge: totals.loadingCharge,
      unloadingCharge: totals.unloadingCharge,
      otherCharge: totals.otherCharge
    });

    res.json({ date, sortOrder, report });

  } catch (error) {
    logger.error('Error generating booking summary report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate booking summary report' });
  }
};

exports.getRevenueReport = async (req, res) => {
  const { date, sortField = 'bookingId', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const bookings = await Booking.find({
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled', 'Pending'] } // exclude unwanted statuses
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .lean();

    const report = bookings.map(b => {
      const freight = b.freightCharge || 0;
      const loading = b.loadingCharge || 0;
      const unloading = b.unloadingCharge || 0;
      const other = b.otherCharge || 0;
      const total = b.totalAmountCharge || 0;

      const bookingExpense = freight * 0.25;
      const lineHaulExpense = freight * 0.4;
      const deliveryExpense = freight * 0.1;
      const otherExcessExpenses = loading + unloading + other;
      const nettRevenue = total - (bookingExpense + lineHaulExpense + deliveryExpense + otherExcessExpenses);

      return {
        date: b.bookingDate,
        bookingId: b.bookingId,
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        freightCharge: freight,
        loadingCharge: loading,
        unloadingCharge: unloading,
        otherCharge: other,
        totalAmountCharge: total,

        bookingExpense,
        lineHaulExpense,
        deliveryExpense,
        otherExcessExpenses,
        nettRevenue
      };
    });

    // Sorting
    const allowedSortFields = ['bookingId', 'date', 'fromOffice', 'toOffice'];
    const order = sortOrder === 'desc' ? -1 : 1;
    const sortKey = allowedSortFields.includes(sortField) ? sortField : 'bookingId';

    report.sort((a, b) => {
      const valA = (a[sortKey] || '').toString().toLowerCase();
      const valB = (b[sortKey] || '').toString().toLowerCase();
      return valA > valB ? order : valA < valB ? -order : 0;
    });

    // Totals
    const totals = report.reduce((acc, r) => {
      acc.freightCharge += r.freightCharge;
      acc.loadingCharge += r.loadingCharge;
      acc.unloadingCharge += r.unloadingCharge;
      acc.otherCharge += r.otherCharge;
      acc.totalAmountCharge += r.totalAmountCharge;
      acc.bookingExpense += r.bookingExpense;
      acc.lineHaulExpense += r.lineHaulExpense;
      acc.deliveryExpense += r.deliveryExpense;
      acc.otherExcessExpenses += r.otherExcessExpenses;
      acc.nettRevenue += r.nettRevenue;
      return acc;
    }, {
      freightCharge: 0,
      loadingCharge: 0,
      unloadingCharge: 0,
      otherCharge: 0,
      totalAmountCharge: 0,
      bookingExpense: 0,
      lineHaulExpense: 0,
      deliveryExpense: 0,
      otherExcessExpenses: 0,
      nettRevenue: 0
    });

    report.push({
        date: '',
        bookingId: 'TOTAL',
        fromOffice: '',
        toOffice: '',
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge,
        bookingExpense: totals.bookingExpense,
        lineHaulExpense: totals.lineHaulExpense,
        deliveryExpense: totals.deliveryExpense,
        otherExcessExpenses: totals.otherExcessExpenses,
        nettRevenue: totals.nettRevenue
    });

    res.json({ date, sortField, sortOrder, report });

  } catch (error) {
    logger.error('Error generating revenue report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
};
