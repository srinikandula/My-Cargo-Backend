const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// CRUD routes
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/search', userController.searchUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;