module.exports = cds.service.impl(async function () {
    // using req.user approach (user attribute - of class cds.User - from the request object)
    this.on('userInfo', req => {
        const user = {
            id : req.user.id,
            tenant : req.user.tenant,
            _roles: req.user._roles,
            attr : req.user.attr
        }

        return user;
    });

    // using the XSUAA API
    this.on('userInfoUAA', async () => {
        return "";
    });
});