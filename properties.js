
module.exports = {
    getAuthUrl: function(idc_name){
    var url = "stdpay.inicis.com/api/payAuth";
    switch (idc_name) {
        case 'fc':
            authUrl = "https://fc"+ url;
            break;
        case 'ks':
            authUrl = "https://ks"+ url;
            break;
        case 'stg':
            authUrl = "https://stg"+ url;
            break;
        default:
            break;
    }
    return authUrl;
},

    getNetCancel: function(idc_name){
    var url = "stdpay.inicis.com/api/netCancel";
    switch (idc_name) {
        case 'fc':
            netCancel = "https://fc"+ url;
            break;
        case 'ks':
            netCancel = "https://ks"+ url;
            break;
        case 'stg':
            netCancel = "https://stg"+ url;
            break;
        default:
            break;
    }			
    return netCancel;
}
};
