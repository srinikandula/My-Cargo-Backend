const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Vehicle = require('../models/Vehicle');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');

exports.getBookingReport = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date is required' });
  }

  try {
    const bookings = await Booking.find({
      operatorId,
      status: 'Booked',
      bookingDate: date
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    if (bookings.length === 0) {
      return res.json({
        date,
        sortField,
        sortOrder,
        report: [{
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
        }]
      });
    }

    const formatDate = (dtStr) => {
      if (!dtStr) return '';
      const date = new Date(dtStr);
      return date.toISOString().split('T')[0];
    };

    const formatTime = (dtStr) => {
      if (!dtStr) return '';
      const date = new Date(dtStr);
      return date.toTimeString().split(' ')[0];
    };

    const report = bookings.map(b => ({
        date: formatDate(b.bookingDate),
        bookingId: b.bookingId,
        senderName: b.senderName || '',
        senderPhone: b.senderPhone || '',
        receiverName: b.receiverName || '',
        receiverPhone: b.receiverPhone || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        lrType: b.lrType,
        quantity: b.quantity,
        freightCharge: b.freightCharge,
        loadingCharge: b.loadingCharge,
        unloadingCharge: b.unloadingCharge,
        otherCharge: b.otherCharge,
        totalAmountCharge: b.totalAmountCharge
        }));

        // Sorting
        const order = sortOrder === 'desc' ? -1 : 1;
        report.sort((a, b) => {
        const valA = a[sortField]?.toString().toLowerCase?.() || '';
        const valB = b[sortField]?.toString().toLowerCase?.() || '';
        return valA > valB ? order : valA < valB ? -order : 0;
        });

        // Totals
        const totals = report.reduce((acc, row) => {
        acc.quantity += row.quantity || 0;
        acc.freightCharge += row.freightCharge || 0;
        acc.loadingCharge += row.loadingCharge || 0;
        acc.unloadingCharge += row.unloadingCharge || 0;
        acc.otherCharge += row.otherCharge || 0;
        acc.totalAmountCharge += row.totalAmountCharge || 0;
        return acc;
        }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
        });

        report.push({
        date: '',
        bookingId: '',
        senderName: '',
        senderPhone: '',
        receiverName: '',
        receiverPhone: '',
        fromOffice: '',
        toOffice: '',
        lrType: 'TOTAL',
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
        });

        res.json({
        date,
        sortField,
        sortOrder,
        report
        });

    } catch (error) {
        logger.error('Error generating booked status report', {
        error: error.message,
        userId: userId?.toString(),
        operatorId: operatorId?.toString()
        });
        res.status(500).json({ error: 'Failed to generate booked status report' });
    }
};

exports.getDelivaryReport = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    // Use arrivalDate to match delivered entries
    const bookings = await Booking.find({
      arrivalDate: date,
      operatorId,
      status: 'Delivered'
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const reportData = bookings.map(b => ({
      date: date.split('-').reverse().join('/'),  // Format to dd/mm/yyyy
      bookingId: b.bookingId,
      senderName: b.senderName || '',
      senderPhone: b.senderPhone || '',
      receiverName: b.receiverName || '',
      receiverPhone: b.receiverPhone || '',
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      unloading: b.unloadingDateTime || '',
      lrType: b.lrType || '',
      quantity: b.quantity || 0,
      totalAmountCharge: b.totalAmountCharge || 0,
      status: b.status || '',
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.otherCharge || 0,
      bookingDate: b.bookingDate || ''
    }));

    // Sort results
    const order = sortOrder === 'desc' ? -1 : 1;
    reportData.sort((a, b) => {
      const valA = (a[sortField] || '').toString().toLowerCase();
      const valB = (b[sortField] || '').toString().toLowerCase();
      return valA > valB ? order : valA < valB ? -order : 0;
    });

    // Calculate totals
    const totals = reportData.reduce((acc, row) => {
      acc.quantity += row.quantity || 0;
      acc.freightCharge += row.freightCharge || 0;
      acc.loadingCharge += row.loadingCharge || 0;
      acc.unloadingCharge += row.unloadingCharge || 0;
      acc.otherCharge += row.otherCharge || 0;
      acc.totalAmountCharge += row.totalAmountCharge || 0;
      return acc;
    }, {
      quantity: 0,
      freightCharge: 0,
      loadingCharge: 0,
      unloadingCharge: 0,
      otherCharge: 0,
      totalAmountCharge: 0
    });

    // Add totals row
    reportData.push({
      date: date.split('-').reverse().join('/'),
      bookingId: '',
      senderName: '',
      senderPhone: '',
      receiverName: '',
      receiverPhone: '',
      fromOffice: '',
      toOffice: '',
      vehicleNumber: '',
      unloading: '',
      lrType: 'TOTAL',
      quantity: totals.quantity,
      totalAmountCharge: totals.totalAmountCharge,
      status: '',
      freightCharge: totals.freightCharge,
      loadingCharge: totals.loadingCharge,
      unloadingCharge: totals.unloadingCharge,
      otherCharge: totals.otherCharge
    });

    res.json({
      date,
      sortBy: sortField,
      sortOrder,
      report: reportData
    });
  } catch (error) {
    logger.error('Error generating delivery report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate delivery report' });
  }
};

exports.getStatusReport = async (req, res) => {
  const {
    date,
    sortField = 'bookingId',
    sortOrder = 'asc'
  } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const bookings = await Booking.find({
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled', 'Pending'] }  // Exclude Cancelled and Pending
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const report = bookings.map(b => {
      const created = new Date(b.createdAt);
      const unloaded = b.unloadingDateTime ? new Date(b.unloadingDateTime) : null;
      const delivered = b.deliveredAt ? new Date(b.deliveredAt) : null;

      return {
        bookingId: b.bookingId,
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        quantity: b.quantity,
        lrType: b.lrType,
        status: b.status,
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',

        dateOfBooking: created.toISOString().slice(0, 10),
        timeOfBooking: created.toTimeString().split(' ')[0],

        unloadedDate: unloaded ? unloaded.toISOString().slice(0, 10) : '',
        unloadedTime: unloaded ? unloaded.toTimeString().split(' ')[0] : '',

        deliveredDate: delivered ? delivered.toISOString().slice(0, 10) : '',
        deliveredTime: delivered ? delivered.toTimeString().split(' ')[0] : '',

        freightCharge: b.freightCharge || 0,
        loadingCharge: b.loadingCharge || 0,
        unloadingCharge: b.unloadingCharge || 0,
        otherCharge: b.otherCharge || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    });

    // Sorting logic
    const allowedSortFields = [
      'vehicleNumber',
      'bookingId',
      'fromOffice',
      'toOffice',
      'dateOfBooking',
      'unloadedDate',
      'deliveredDate'
    ];
    const order = sortOrder === 'desc' ? -1 : 1;
    const sortKey = allowedSortFields.includes(sortField) ? sortField : 'bookingId';

    report.sort((a, b) => {
      const valA = (a[sortKey] || '').toString().toLowerCase();
      const valB = (b[sortKey] || '').toString().toLowerCase();
      return valA > valB ? order : valA < valB ? -order : 0;
    });

    // Totals row
    const totals = report.reduce((acc, r) => {
      acc.quantity += r.quantity || 0;
      acc.freightCharge += r.freightCharge;
      acc.loadingCharge += r.loadingCharge;
      acc.unloadingCharge += r.unloadingCharge;
      acc.otherCharge += r.otherCharge;
      acc.totalAmountCharge += r.totalAmountCharge;
      return acc;
    }, {
      quantity: 0,
      freightCharge: 0,
      loadingCharge: 0,
      unloadingCharge: 0,
      otherCharge: 0,
      totalAmountCharge: 0
    });

    report.push({
      bookingId: '',
      fromOffice: '',
      toOffice: '',
      quantity: totals.quantity,
      lrType: 'TOTAL',
      status: '',
      vehicleNumber: '',
      dateOfBooking: '',
      timeOfBooking: '',
      unloadedDate: '',
      unloadedTime: '',
      deliveredDate: '',
      deliveredTime: '',

      freightCharge: totals.freightCharge,
      loadingCharge: totals.loadingCharge,
      unloadingCharge: totals.unloadingCharge,
      otherCharge: totals.otherCharge,
      totalAmountCharge: totals.totalAmountCharge
    });

    res.json({ date, sortField, sortOrder, report });

  } catch (error) {
    logger.error('Error generating status report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate status report' });
  }
};

exports.getLoadingReport = async (req, res) => {
  const {
    date,
    sortField = 'loadingDateTime',
    sortOrder = 'asc'
  } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const bookings = await Booking.find({
      bookingDate: date,
      operatorId,
      status: 'InTransit'  // 🔄 Only include InTransit bookings
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const report = bookings.map(b => {
      const loadingDateTime = b.loadingDateTime || b.createdAt;
      const loadingDate = new Date(loadingDateTime);

      return {
        bookingDate: b.bookingDate,
        loadingDateTime: loadingDate.toISOString(),
        bookingId: b.bookingId,
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        status: b.status,
        noOfBookings: 1,
        quantity: b.quantity,
        freightCharge: b.freightCharge || 0,
        otherCharge: b.otherCharge || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    });

    // Sort logic
    const allowedSortFields = [
      'loadingDateTime', 'vehicleNumber', 'fromOffice', 'toOffice'
    ];
    const order = sortOrder === 'desc' ? -1 : 1;
    const sortKey = allowedSortFields.includes(sortField) ? sortField : 'loadingDateTime';

    report.sort((a, b) => {
      const valA = (a[sortKey] || '').toString().toLowerCase();
      const valB = (b[sortKey] || '').toString().toLowerCase();
      return valA > valB ? order : valA < valB ? -order : 0;
    });

    // Totals row
    const totals = report.reduce((acc, r) => {
      acc.noOfBookings += r.noOfBookings || 0;
      acc.quantity += r.quantity || 0;
      acc.freightCharge += r.freightCharge;
      acc.otherCharge += r.otherCharge;
      acc.totalAmountCharge += r.totalAmountCharge;
      return acc;
    }, {
      noOfBookings: 0,
      quantity: 0,
      freightCharge: 0,
      otherCharge: 0,
      totalAmountCharge: 0
    });

    report.push({
      bookingDate: '',
      loadingDateTime: '',
      bookingId: '',
      vehicleNumber: '',
      fromOffice: '',
      toOffice: '',
      status: '',
      noOfBookings: totals.noOfBookings,
      quantity: totals.quantity,
      freightCharge: totals.freightCharge,
      otherCharge: totals.otherCharge,
      totalAmountCharge: totals.totalAmountCharge
    });

    res.json({ date, sortField, sortOrder, report });

  } catch (error) {
    logger.error('Error generating loading report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate loading report' });
  }
};

exports.getUnloadingReport = async (req, res) => {
   const {
    date,
    sortField = 'loadingDateTime',
    sortOrder = 'asc'
  } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const bookings = await Booking.find({
      bookingDate: date,
      operatorId,
      status: 'Arrived' 
    })
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const report = bookings.map(b => {
      const loadingDateTime = b.loadingDateTime || b.createdAt;
      const loadingDate = new Date(loadingDateTime);

      return {
        bookingDate: b.bookingDate,
        loadingDateTime: loadingDate.toISOString(),
        bookingId: b.bookingId,
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        status: b.status,
        noOfBookings: 1,
        quantity: b.quantity,
        freightCharge: b.freightCharge || 0,
        otherCharge: b.otherCharge || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    });

    // Sort logic
    const allowedSortFields = [
      'loadingDateTime', 'vehicleNumber', 'fromOffice', 'toOffice'
    ];
    const order = sortOrder === 'desc' ? -1 : 1;
    const sortKey = allowedSortFields.includes(sortField) ? sortField : 'loadingDateTime';

    report.sort((a, b) => {
      const valA = (a[sortKey] || '').toString().toLowerCase();
      const valB = (b[sortKey] || '').toString().toLowerCase();
      return valA > valB ? order : valA < valB ? -order : 0;
    });

    // Totals row
    const totals = report.reduce((acc, r) => {
      acc.noOfBookings += r.noOfBookings || 0;
      acc.quantity += r.quantity || 0;
      acc.freightCharge += r.freightCharge;
      acc.otherCharge += r.otherCharge;
      acc.totalAmountCharge += r.totalAmountCharge;
      return acc;
    }, {
      noOfBookings: 0,
      quantity: 0,
      freightCharge: 0,
      otherCharge: 0,
      totalAmountCharge: 0
    });

    report.push({
      bookingDate: '',
      loadingDateTime: '',
      bookingId: '',
      vehicleNumber: '',
      fromOffice: '',
      toOffice: '',
      status: '',
      noOfBookings: totals.noOfBookings,
      quantity: totals.quantity,
      freightCharge: totals.freightCharge,
      otherCharge: totals.otherCharge,
      totalAmountCharge: totals.totalAmountCharge
    });

    res.json({ date, sortField, sortOrder, report });

  } catch (error) {
    logger.error('Error generating loading report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate loading report' });
  }
};