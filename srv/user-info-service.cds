service UserInfoService @(path : '/user-info', requires: 'authenticated-user') {
    function userInfo() returns String; // using req.user approach (user attribute - of class cds.User - from the request object)
    function userInfoUAA() returns String; // using the XSUAA API
}