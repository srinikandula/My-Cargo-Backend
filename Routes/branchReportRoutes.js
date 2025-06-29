const express = require('express');
const router = express.Router();
const BranchReportController = require('../controllers/branchReportController');
const passport = require('passport');

router.use(passport.authenticate('jwt', { session: false }));

router.get('/branchExport', BranchReportController.exportBranchReportExcel);
router.get('/revenueExport', BranchReportController.exportRevenueReportExcel);
router.post('/branchReport', BranchReportController.getBranchReport);
router.post('/revenueReport', BranchReportController.getRevenueReport);

module.exports = router;
