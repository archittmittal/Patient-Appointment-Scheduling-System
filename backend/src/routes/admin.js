const express = require('express');
const router = express.Router();

// Mount decomposed admin routes (PR #14)
router.use('/', require('./admin-users'));
router.use('/', require('./admin-appointments'));
router.use('/', require('./admin-departments'));

module.exports = router;
