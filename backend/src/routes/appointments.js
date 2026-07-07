const express = require('express');
const router = express.Router();

// Mount decomposed appointment routes (PR #14)
router.use('/', require('./booking'));
router.use('/', require('./queue'));
router.use('/', require('./waitlist'));
router.use('/', require('./appointment-analytics'));

module.exports = router;
