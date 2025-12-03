const router = require('express').Router();
const { isAuthenticated, hasRole } = require('../middleware/auth');

router.get("/", (req, res) => {
    res.redirect("/dashboard");
});

router.get("/dashboard", isAuthenticated, (req, res) => {
    res.render("dashboard");
});

router.get("/enrollment", isAuthenticated, hasRole('admin', 'teacher'), (req, res) => {
    res.render("enrollment");
});

router.get("/reports", isAuthenticated, hasRole('admin', 'teacher', 'student'), (req, res) => {
    res.render("reports");
});

router.get("/settings", isAuthenticated, hasRole('admin', 'teacher'), (req, res) => {
    res.render("settings");
});

router.get("/terminal", isAuthenticated, hasRole('admin', 'teacher'), (req, res) => {
    res.render("terminal");
});

module.exports = router;