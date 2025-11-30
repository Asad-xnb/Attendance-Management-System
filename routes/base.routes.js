const router = require('express').Router();

router.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

router.get("/enrollment", (req, res) => {
    res.render("enrollment");
});

router.get("/reports", (req, res) => {
    res.render("reports");
});

router.get("/settings", (req, res) => {
    res.render("settings");
});

router.get("/terminal", (req, res) => {
    res.render("terminal");
});

router.get("/login", (req, res) => {
    res.render("login");
});


module.exports = router;