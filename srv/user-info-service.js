module.exports = cds.service.impl(async function () {
    this.on('userInfo', (req) => {
        return {
            id: req.user.id,
            tenant: req.user.tenant,
            _roles: req.user._roles,
            attr: req.user.attr
        };
    });

    this.on('userInfoUAA', async () => {
        return "";
    });
});
