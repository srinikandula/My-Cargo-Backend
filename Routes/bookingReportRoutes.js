const express = require('express');
const router = express.Router();
const bookingReportController = require('../controllers/bookingReportController');
const passport = require('passport');

router.use(passport.authenticate('jwt', { session: false }));


router.get('/bookingExport', bookingReportController.exportBookingReportExcel);
router.get('/deliveryExport', bookingReportController.exportDelivaryReportExcel);
router.get('/statusExport', bookingReportController.exportStatusReportExcel);
router.get('/loadingExport', bookingReportController.exportLoadingReportExcel);
router.get('/unloadingExport', bookingReportController.exportUnloadingReportExcel);
router.get('/IGCLExport', bookingReportController.exportIGCLReportExcel);
router.get('/OGCLExport', bookingReportController.exportOGCLReportExcel);
router.post('/bookingReport', bookingReportController.getBookingReport);
router.post('/deliveryReport', bookingReportController.getDelivaryReport);
router.post('/statusReport', bookingReportController.getStatusReport);
router.post('/loadingReport', bookingReportController.getLoadingReport);
router.post('/unloadingReport', bookingReportController.getUnloadingReport);
router.post('/IGCLreport', bookingReportController.getIGCLreport);
router.post('/OGCLreport', bookingReportController.getOGCLreport);

module.exports = router;
