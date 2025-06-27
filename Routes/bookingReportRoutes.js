const express = require('express');
const router = express.Router();
const bookingReportController = require('../controllers/bookingReportController');
const passport = require('passport');

router.use(passport.authenticate('jwt', { session: false }));
router.get('/bookingReport', bookingReportController.getBookingReport);
router.get('/deliveryReport', bookingReportController.getDelivaryReport);
router.get('/statusReport', bookingReportController.getStatusReport);
router.get('/loadingReport', bookingReportController.getLoadingReport);
router.get('/unloadingReport', bookingReportController.getUnloadingReport);

module.exports = router;
