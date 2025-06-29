const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Vehicle = require('../models/Vehicle');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');
const XLSX = require('xlsx');

exports.getBranchReport = async (req, res) => {
  const {
    date,
    sortOrder = 'asc',
    page = 1,
    limit = 10
  } = req.body;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled'] }
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (Number(page) - 1) * Number(limit);
    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .sort({ 'fromOffice.name': order, bookingDate: order })
      .skip(skip)
      .limit(Number(limit))
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

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allMatchingBookings = await Booking.find(filter).lean();
      const totals = allMatchingBookings.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.otherCharge || 0;
        return acc;
      }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0
      });

      totalsRow = {
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
      };
    }

    res.json({
      date,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      sortOrder,
      report,
      ...(totalsRow && { totalsRow })
    });

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
  const {
    date,
    sortField = 'bookingId',
    sortOrder = 'asc',
    page = 1,
    limit = 10
  } = req.body;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled', 'Pending'] }
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (Number(page) - 1) * Number(limit);
    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .sort({ [sortField]: order })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const calculateValues = (b) => {
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

      return { freight, loading, unloading, other, total, bookingExpense, lineHaulExpense, deliveryExpense, otherExcessExpenses, nettRevenue };
    };

    const report = bookings.map(b => {
      const vals = calculateValues(b);
      return {
        date: b.bookingDate,
        bookingId: b.bookingId,
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        freightCharge: vals.freight,
        loadingCharge: vals.loading,
        unloadingCharge: vals.unloading,
        otherCharge: vals.other,
        totalAmountCharge: vals.total,
        bookingExpense: vals.bookingExpense,
        lineHaulExpense: vals.lineHaulExpense,
        deliveryExpense: vals.deliveryExpense,
        otherExcessExpenses: vals.otherExcessExpenses,
        nettRevenue: vals.nettRevenue
      };
    });

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allMatchingBookings = await Booking.find(filter).lean();

      const totals = allMatchingBookings.reduce((acc, b) => {
        const vals = calculateValues(b);
        acc.freightCharge += vals.freight;
        acc.loadingCharge += vals.loading;
        acc.unloadingCharge += vals.unloading;
        acc.otherCharge += vals.other;
        acc.totalAmountCharge += vals.total;
        acc.bookingExpense += vals.bookingExpense;
        acc.lineHaulExpense += vals.lineHaulExpense;
        acc.deliveryExpense += vals.deliveryExpense;
        acc.otherExcessExpenses += vals.otherExcessExpenses;
        acc.nettRevenue += vals.nettRevenue;
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

      totalsRow = {
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
      };
    }

    res.json({
      date,
      sortField,
      sortOrder,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report,
      ...(totalsRow && { totalsRow })
    });

  } catch (error) {
    logger.error('Error generating revenue report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
};

exports.exportBranchReportExcel = async (req, res) => {
  const { date, sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled'] }
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .sort({ 'fromOffice.name': order, bookingDate: order })
      .lean();

    const report = bookings.map(b => ({
      BookingDate: b.bookingDate,
      BranchName: b.fromOffice?.name || '',
      BookingID: b.bookingId,
      LRType: b.lrType,
      Status: b.status,
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      PaymentType: b.paymentType || '',
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.otherCharge || 0
    }));

    // Totals
    const totals = report.reduce((acc, r) => {
      acc.Quantity += r.Quantity;
      acc.FreightCharge += r.FreightCharge;
      acc.LoadingCharge += r.LoadingCharge;
      acc.UnloadingCharge += r.UnloadingCharge;
      acc.OtherCharge += r.OtherCharge;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0
    });

    // Add totals row
    report.push({
      BookingDate: '',
      BranchName: '',
      BookingID: '',
      LRType: '',
      Status: '',
      FromOffice: '',
      ToOffice: '',
      PaymentType: 'TOTAL',
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge
    });

    // Excel generation
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Branch Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=branch_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting branch report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export branch report' });
  }
};

exports.exportRevenueReportExcel = async (req, res) => {
  const { date, sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled', 'Pending'] }
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .sort({ 'fromOffice.name': order, bookingDate: order })
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
      const otherExpenses = loading + unloading + other;
      const nettRevenue = total - (bookingExpense + lineHaulExpense + deliveryExpense + otherExpenses);

      return {
        BookingDate: b.bookingDate,
        BranchName: b.fromOffice?.name || '',
        BookingID: b.bookingId,
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Freight: freight,
        Loading: loading,
        Unloading: unloading,
        Other: other,
        TotalAmount: total,
        BookingExpense: bookingExpense,
        LineHaulExpense: lineHaulExpense,
        DeliveryExpense: deliveryExpense,
        OtherExpenses: otherExpenses,
        NettRevenue: nettRevenue
      };
    });

    // Totals row
    const totals = report.reduce((acc, r) => {
      acc.Freight += r.Freight;
      acc.Loading += r.Loading;
      acc.Unloading += r.Unloading;
      acc.Other += r.Other;
      acc.TotalAmount += r.TotalAmount;
      acc.BookingExpense += r.BookingExpense;
      acc.LineHaulExpense += r.LineHaulExpense;
      acc.DeliveryExpense += r.DeliveryExpense;
      acc.OtherExpenses += r.OtherExpenses;
      acc.NettRevenue += r.NettRevenue;
      return acc;
    }, {
      Freight: 0,
      Loading: 0,
      Unloading: 0,
      Other: 0,
      TotalAmount: 0,
      BookingExpense: 0,
      LineHaulExpense: 0,
      DeliveryExpense: 0,
      OtherExpenses: 0,
      NettRevenue: 0
    });

    // Add totals row
    report.push({
      BookingDate: '',
      BranchName: '',
      BookingID: '',
      FromOffice: '',
      ToOffice: 'TOTAL',
      Freight: totals.Freight,
      Loading: totals.Loading,
      Unloading: totals.Unloading,
      Other: totals.Other,
      TotalAmount: totals.TotalAmount,
      BookingExpense: totals.BookingExpense,
      LineHaulExpense: totals.LineHaulExpense,
      DeliveryExpense: totals.DeliveryExpense,
      OtherExpenses: totals.OtherExpenses,
      NettRevenue: totals.NettRevenue
    });

    // Excel generation
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=revenue_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting revenue report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export revenue report' });
  }
};

