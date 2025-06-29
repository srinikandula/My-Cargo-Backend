const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Vehicle = require('../models/Vehicle');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');
const XLSX = require('xlsx');

exports.getBookingReport = async (req, res) => {
  const {
    date,
    sortField = 'bookingDate',
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
      bookingDate: date.trim(),
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] }
    };

    console.log('Booking Report Filter:', filter);

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const reportData = bookings.map(b => ({
      date: b.bookingDate || '',
      bookingId: b.bookingId || '',
      senderName: b.senderName || '',
      senderPhone: b.senderPhone || '',
      receiverName: b.receiverName || '',
      receiverPhone: b.receiverPhone || '',
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      lrType: b.lrType || '',
      quantity: b.quantity || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.otherCharge || 0,
      totalAmountCharge: b.totalAmountCharge || 0,
      status: b.status || ''
    }));

    let totalsRow = null;

    // Only calculate and return totalsRow on last page
    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, row) => {
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

      totalsRow = {
        blankDate: '',
        blankBookingId: '',
        blankSenderName: '',
        blankSenderPhone: '',
        blankReceiverName: '',
        blankReceiverPhone: '',
        blankFromOffice: '',
        blankToOffice: '',
        blankLrType: 'TOTAL',
        blankQuantity: totals.quantity,
        blankFreightCharge: totals.freightCharge,
        blankLoadingCharge: totals.loadingCharge,
        blankUnloadingCharge: totals.unloadingCharge,
        blankOtherCharge: totals.otherCharge,
        blankTotalAmountCharge: totals.totalAmountCharge,
        blankStatus: ''
      };
    }

    res.json({
      date,
      sortBy: sortField,
      sortOrder,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report: reportData,
      ...(totalsRow && { totalsRow })  // only add if it exists
    });

  } catch (error) {
    logger.error('Error generating booking report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate booking report' });
  }
};

exports.getDelivaryReport = async (req, res) => {
  const {
    date,
    sortField = 'bookingDate',
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
      arrivalDate: date,
      operatorId,
      status: 'Delivered'
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const formattedDate = date.split('-').reverse().join('/'); // dd/mm/yyyy

    const reportData = bookings.map(b => ({
      date: formattedDate,
      bookingId: b.bookingId,
      senderName: b.senderName || '',
      senderPhone: b.senderPhone || '',
      receiverName: b.receiverName || '',
      receiverPhone: b.receiverPhone || '',
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      lrType: b.lrType || '',
      deliveryType: 'Self',
      vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      unloading: b.unloadingDateTime || '',
      quantity: b.quantity || 0,
      totalAmountCharge: b.totalAmountCharge || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.otherCharge || 0,
      bookingDate: b.bookingDate || '',
      status: b.status || ''
    }));

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, row) => {
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

      totalsRow = {
        blankDate: formattedDate,
        bookingId: '',
        senderName: '',
        senderPhone: '',
        receiverName: '',
        receiverPhone: '',
        fromOffice: '',
        toOffice: '',
        lrType: '',
        deliveryType: '',
        vehicleNumber: '',
        unloading: 'TOTAL',
        quantity: totals.quantity,
        totalAmountCharge: totals.totalAmountCharge,
        status: '',
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge
      };
    }

    res.json({
      date,
      sortBy: sortField,
      sortOrder,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report: reportData,
      ...(totalsRow && { totalsRow }) // conditionally add if exists
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
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const report = bookings.map(b => {
      const created = new Date(b.createdAt);
      const unloaded = b.unloadingDateTime ? new Date(b.unloadingDateTime) : null;
      const delivered = b.deliveredAt ? new Date(b.deliveredAt) : null;

      return {
        bookingId: b.bookingId,
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        quantity: b.quantity || 0,
        lrType: b.lrType || '',
        status: b.status || '',
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

    let totalsRow = null;

    // Compute totals only if it's the last page and records exist
    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.otherCharge || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
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
      status: 'InTransit'
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit))
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
        quantity: b.quantity || 0,
        freightCharge: b.freightCharge || 0,
        otherCharge: b.otherCharge || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    });

    let totalsRow = null;

    // Compute totals if it's the last page and data exists
    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.noOfBookings += 1;
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.otherCharge += r.otherCharge || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        noOfBookings: 0,
        quantity: 0,
        freightCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        bookingId: '',
        vehicleNumber: '',
        fromOffice: '',
        toOffice: '',
        status: 'TOTAL',
        noOfBookings: totals.noOfBookings,
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
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
      status: 'Arrived'
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const report = bookings.map(b => {
      const loadingDateTime = b.loadingDateTime || b.createdAt;
      const loadingDate = new Date(loadingDateTime);

      return {
        bookingDate: b.bookingDate,
        loadingDateTime: loadingDate.toISOString(),
        unloadingDateTime: b.unloadingDateTime || '',
        bookingId: b.bookingId,
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        status: b.status,
        noOfBookings: 1,
        quantity: b.quantity || 0,
        freightCharge: b.freightCharge || 0,
        otherCharge: b.otherCharge || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    });

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.noOfBookings += 1;
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.otherCharge += r.otherCharge || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        noOfBookings: 0,
        quantity: 0,
        freightCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        unloadingDateTime: '',
        bookingId: '',
        vehicleNumber: '',
        fromOffice: '',
        toOffice: '',
        status: 'TOTAL',
        noOfBookings: totals.noOfBookings,
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
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
      ...(totalsRow && { totalsRow }) // only include if it's set
    });

  } catch (error) {
    logger.error('Error generating unloading report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate unloading report' });
  }
};

exports.getIGCLreport = async (req, res) => {
  const { date, page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formatDate = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toISOString().split('T')[0];
    };

    const formatDateTime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
    };

    const report = bookings.map(b => ({
      bookingDate: formatDate(b.bookingDate),
      loadingDateTime: formatDateTime(b.loadingDateTime || b.loadingDate),
      bookingId: b.bookingId,
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      quantity: b.quantity || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.otherCharge || 0,
      totalAmountCharge: b.totalAmountCharge || 0
    }));

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.otherCharge || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        bookingId: '',
        fromOffice: '',
        toOffice: '',
        vehicleNumber: 'TOTAL',
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({
      date,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report,
      ...(totalsRow && { totalsRow })
    });

  } catch (error) {
    logger.error('Error generating IGCL report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate IGCL report' });
  }
};

exports.getOGCLreport = async (req, res) => {
  const { date, page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formatDate = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toISOString().split('T')[0];
    };

    const formatDateTime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
    };

    const report = bookings.map(b => ({
      bookingDate: formatDate(b.bookingDate),
      loadingDateTime: formatDateTime(b.loadingDateTime || b.loadingDate),
      bookingId: b.bookingId,
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      quantity: b.quantity || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.otherCharge || 0,
      totalAmountCharge: b.totalAmountCharge || 0
    }));

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.otherCharge || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        bookingId: '',
        fromOffice: '',
        toOffice: '',
        vehicleNumber: 'TOTAL',
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({
      date,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report,
      ...(totalsRow && { totalsRow })
    });

  } catch (error) {
    logger.error('Error generating OGCL report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate OGCL report' });
  }
};

exports.exportBookingReportExcel = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date.trim(),
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] }
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    // Fetch all bookings in one query
    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber') // Only include if used
      .sort({ [sortField]: order })
      .lean();

    const formattedDate = date.split('-').reverse().join('/'); // Convert to dd/mm/yyyy format

    // Build report data
    const reportData = bookings.map(b => ({
      Date: formattedDate,
      BookingID: b.bookingId || '',
      SenderName: b.senderName || '',
      SenderPhone: b.senderPhone || '',
      ReceiverName: b.receiverName || '',
      ReceiverPhone: b.receiverPhone || '',
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      LRType: b.lrType || '',
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.otherCharge || 0,
      TotalAmountCharge: b.totalAmountCharge || 0,
      status: b.status
    }));

    // Totals row
    const totals = bookings.reduce((acc, row) => {
      acc.Quantity += row.quantity || 0;
      acc.FreightCharge += row.freightCharge || 0;
      acc.LoadingCharge += row.loadingCharge || 0;
      acc.UnloadingCharge += row.unloadingCharge || 0;
      acc.OtherCharge += row.otherCharge || 0;
      acc.TotalAmountCharge += row.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    reportData.push({
      Date: '',
      BookingID: '',
      SenderName: '',
      SenderPhone: '',
      ReceiverName: '',
      ReceiverPhone: '',
      FromOffice: '',
      ToOffice: '',
      LRType: 'TOTAL',
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      status: ''
    });

    // Generate Excel
    const worksheet = XLSX.utils.json_to_sheet(reportData, {
      header: [
        'Date', 'BookingID', 'SenderName', 'SenderPhone', 'ReceiverName', 'ReceiverPhone',
        'FromOffice', 'ToOffice', 'LRType', 'Quantity', 'FreightCharge',
        'LoadingCharge', 'UnloadingCharge', 'OtherCharge', 'TotalAmountCharge', 'status'
        // 'VehicleNumber' // add if included above
      ]
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Booking Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    const safeDate = date.replace(/[^\w\-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=booking_report_${safeDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting booking report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export booking report' });
  }
};

exports.exportDelivaryReportExcel = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      arrivalDate: date,
      operatorId,
      status: 'Delivered'
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    const formattedDate = date.split('-').reverse().join('/'); // dd/mm/yyyy

    const reportData = bookings.map(b => ({
      Date: formattedDate,
      BookingID: b.bookingId,
      SenderName: b.senderName || '',
      SenderPhone: b.senderPhone || '',
      ReceiverName: b.receiverName || '',
      ReceiverPhone: b.receiverPhone || '',
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      LRType: b.lrType || '',
      DeliveryType: 'Self',
      VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      Unloading: b.unloadingDateTime || '',
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.otherCharge || 0,
      TotalAmountCharge: b.totalAmountCharge || 0,
      status: b.status
    }));

    // Totals over all matching documents
    const allBookings = await Booking.find(filter).lean();
    const totals = allBookings.reduce((acc, row) => {
      acc.Quantity += row.quantity || 0;
      acc.TotalAmountCharge += row.totalAmountCharge || 0;
      acc.FreightCharge += row.freightCharge || 0;
      acc.LoadingCharge += row.loadingCharge || 0;
      acc.UnloadingCharge += row.unloadingCharge || 0;
      acc.OtherCharge += row.otherCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      TotalAmountCharge: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0
    });

    // Add total row
    reportData.push({
      Date: '',
      BookingID: '',
      SenderName: '',
      SenderPhone: '',
      ReceiverName: '',
      ReceiverPhone: '',
      FromOffice: '',
      ToOffice: '',
      LRType: '',
      DeliveryType: '',
      VehicleNumber: '',
      Unloading: 'TOTAL',
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      status: ''
    });

    // Generate Excel
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=delivery_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting delivery report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export delivery report' });
  }
};

exports.exportStatusReportExcel = async (req, res) => {
  const {
    date,
    sortField = 'bookingId',
    sortOrder = 'asc',
  } = req.query;

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
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    const reportData = bookings.map(b => {
      const created = new Date(b.createdAt);
      const unloaded = b.unloadingDateTime ? new Date(b.unloadingDateTime) : null;
      const delivered = b.deliveredAt ? new Date(b.deliveredAt) : null;

      return {
        BookingID: b.bookingId,
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Quantity: b.quantity || 0,
        LRType: b.lrType || '',
        Status: b.status || '',
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',

        DateOfBooking: created.toISOString().slice(0, 10),
        TimeOfBooking: created.toTimeString().split(' ')[0],

        UnloadedDate: unloaded ? unloaded.toISOString().slice(0, 10) : '',
        UnloadedTime: unloaded ? unloaded.toTimeString().split(' ')[0] : '',

        DeliveredDate: delivered ? delivered.toISOString().slice(0, 10) : '',
        DeliveredTime: delivered ? delivered.toTimeString().split(' ')[0] : '',

        FreightCharge: b.freightCharge || 0,
        LoadingCharge: b.loadingCharge || 0,
        UnloadingCharge: b.unloadingCharge || 0,
        OtherCharge: b.otherCharge || 0,
        TotalAmountCharge: b.totalAmountCharge || 0,
        status: b.status
      };
    });

    // Calculate totals for all matching bookings
    const totals = bookings.reduce((acc, r) => {
      acc.Quantity += r.quantity || 0;
      acc.FreightCharge += r.freightCharge || 0;
      acc.LoadingCharge += r.loadingCharge || 0;
      acc.UnloadingCharge += r.unloadingCharge || 0;
      acc.OtherCharge += r.otherCharge || 0;
      acc.TotalAmountCharge += r.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    // Add a totals row at the end
    reportData.push({
      BookingID: '',
      FromOffice: '',
      ToOffice: '',
      Quantity: totals.Quantity,
      LRType: 'TOTAL',
      Status: '',
      VehicleNumber: '',
      DateOfBooking: '',
      TimeOfBooking: '',
      UnloadedDate: '',
      UnloadedTime: '',
      DeliveredDate: '',
      DeliveredTime: '',
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      status: ''
    });

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Status Report');

    // Write workbook buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Set headers and send file
    res.setHeader('Content-Disposition', `attachment; filename=status_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting status report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export status report' });
  }
};

exports.exportLoadingReportExcel = async (req, res) => {
  const {
    date,
    sortField = 'loadingDateTime',
    sortOrder = 'asc',
  } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: 'InTransit'
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    const reportData = bookings.map(b => {
      const loadingDateTime = b.loadingDateTime || b.createdAt;
      const loadingDate = new Date(loadingDateTime);

      return {
        BookingDate: b.bookingDate,
        LoadingDateTime: loadingDate.toISOString(),
        BookingId: b.bookingId,
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Status: b.status,
        NoOfBookings: 1,
        Quantity: b.quantity || 0,
        FreightCharge: b.freightCharge || 0,
        OtherCharge: b.otherCharge || 0,
        TotalAmountCharge: b.totalAmountCharge || 0
      };
    });

    const totals = bookings.reduce((acc, b) => {
      acc.NoOfBookings += 1;
      acc.Quantity += b.quantity || 0;
      acc.FreightCharge += b.freightCharge || 0;
      acc.OtherCharge += b.otherCharge || 0;
      acc.TotalAmountCharge += b.totalAmountCharge || 0;
      return acc;
    }, {
      NoOfBookings: 0,
      Quantity: 0,
      FreightCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    reportData.push({
      BookingDate: '',
      LoadingDateTime: '',
      BookingId: '',
      VehicleNumber: '',
      FromOffice: '',
      ToOffice: '',
      Status: 'TOTAL',
      NoOfBookings: totals.NoOfBookings,
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Loading Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=loading_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting loading report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export loading report' });
  }
};

exports.exportUnloadingReportExcel = async (req, res) => {
  const {
    date,
    sortField = 'loadingDateTime',
    sortOrder = 'asc',
  } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    // Build filter
    const filter = {
      bookingDate: date,
      operatorId,
      status: 'Arrived' // Change this to $in: [...] if needed
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    // Fetch all matching bookings (no pagination for export)
    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    // If no bookings found, return early with a message
    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ error: 'No unloading bookings found for the given date' });
    }

    // Prepare report rows
    const reportData = bookings.map(b => {
      const loadingDateTime = b.loadingDateTime || b.createdAt;
      const unloadingDateTime = b.unloadingDateTime || '';

      return {
        BookingDate: b.bookingDate || '',
        LoadingDateTime: new Date(loadingDateTime).toISOString(),
        UnloadingDateTime: unloadingDateTime ? new Date(unloadingDateTime).toISOString() : '',
        BookingId: b.bookingId || '',
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Status: b.status || '',
        NoOfBookings: 1,
        Quantity: b.quantity || 0,
        FreightCharge: b.freightCharge || 0,
        OtherCharge: b.otherCharge || 0,
        TotalAmountCharge: b.totalAmountCharge || 0
      };
    });

    // Totals calculation
    const totals = bookings.reduce((acc, b) => {
      acc.NoOfBookings += 1;
      acc.Quantity += b.quantity || 0;
      acc.FreightCharge += b.freightCharge || 0;
      acc.OtherCharge += b.otherCharge || 0;
      acc.TotalAmountCharge += b.totalAmountCharge || 0;
      return acc;
    }, {
      NoOfBookings: 0,
      Quantity: 0,
      FreightCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0,
    });

    // Push totals row
    reportData.push({
      BookingDate: '',
      LoadingDateTime: '',
      UnloadingDateTime: '',
      BookingId: '',
      VehicleNumber: '',
      FromOffice: '',
      ToOffice: '',
      Status: 'TOTAL',
      NoOfBookings: totals.NoOfBookings,
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge
    });

    // Create Excel sheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Unloading Report');

    // Generate Excel buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Set headers and send Excel file
    res.setHeader('Content-Disposition', `attachment; filename=unloading_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting unloading report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export unloading report' });
  }
};

exports.exportIGCLReportExcel = async (req, res) => {
  const { date } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const formatDate = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toISOString().split('T')[0];
    };

    const formatDateTime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
    };

    const report = bookings.map(b => ({
      BookingDate: formatDate(b.bookingDate),
      LoadingDateTime: formatDateTime(b.loadingDateTime || b.loadingDate),
      BookingId: b.bookingId,
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.otherCharge || 0,
      TotalAmountCharge: b.totalAmountCharge || 0,
      status: b.status
    }));

    // Totals
    const totals = bookings.reduce((acc, r) => {
      acc.Quantity += r.quantity || 0;
      acc.FreightCharge += r.freightCharge || 0;
      acc.LoadingCharge += r.loadingCharge || 0;
      acc.UnloadingCharge += r.unloadingCharge || 0;
      acc.OtherCharge += r.otherCharge || 0;
      acc.TotalAmountCharge += r.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    // Push total row
    report.push({
      VehicleNumber: 'TOTAL',
      Quantity: '',
      BookingDate: '',
      LoadingDateTime: '',
      BookingId: '',
      FromOffice: '',
      ToOffice: '',
      ...totals
    });

    // Create Excel sheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IGCL Report');

    // Buffer the workbook
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Send Excel file
    res.setHeader('Content-Disposition', `attachment; filename=igcl_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting IGCL report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export IGCL report' });
  }
};

exports.exportOGCLReportExcel = async (req, res) => {
  const { date } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || !operatorId) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const formatDate = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toISOString().split('T')[0];
    };

    const formatDateTime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
    };

    const report = bookings.map(b => ({
      BookingDate: formatDate(b.bookingDate),
      LoadingDateTime: formatDateTime(b.loadingDateTime || b.loadingDate),
      BookingId: b.bookingId,
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.otherCharge || 0,
      TotalAmountCharge: b.totalAmountCharge || 0,
      status: b.status
    }));

    // Totals
    const totals = bookings.reduce((acc, r) => {
      acc.Quantity += r.quantity || 0;
      acc.FreightCharge += r.freightCharge || 0;
      acc.LoadingCharge += r.loadingCharge || 0;
      acc.UnloadingCharge += r.unloadingCharge || 0;
      acc.OtherCharge += r.otherCharge || 0;
      acc.TotalAmountCharge += r.totalAmountCharge || 0;
      return acc;
    }, {
      vehicleNumber: 'Total',
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    // Push total row
    report.push({
      BookingDate: '',
      LoadingDateTime: '',
      BookingId: '',
      FromOffice: '',
      ToOffice: '',
      ...totals
    });

    // Create Excel sheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OGCL Report');

    // Buffer the workbook
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Send Excel file
    res.setHeader('Content-Disposition', `attachment; filename=ogcl_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting OGCL report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export OGCL report' });
  }
};