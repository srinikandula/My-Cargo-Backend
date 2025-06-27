const express = require('express');
const router = express.Router();
const BranchReportController = require('../controllers/branchReportController');
const passport = require('passport');

router.use(passport.authenticate('jwt', { session: false }));

router.get('/branchReport', BranchReportController.getBranchReport);
router.get('/revenueReport', BranchReportController.getRevenueReport);

module.exports = router;
