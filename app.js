const express = require('express');
const app = express();
const crypto = require('crypto');
const bodyParser = require('body-parser');
const request = require('request');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('views', __dirname + '/views');
app.set('views engline', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(express.static('views'));
const getUrl = require('./properties');

const {
  P_MID = 'INIpayTest',
  INICS_WEB_URL = 'https://stgstdpay.inicis.com/stdjs/INIStdPay.js',
  INICS_WEB_CLOSE_URL = 'https://stdpay.inicis.com/stdjs/INIStdPay_close.js',
  BASE_URL = 'http://localhost:3000',
  INICS_SIGN_KEY = 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS',
} = process.env;

app.get('/', (req, res) => {
  const mid = P_MID; // 상점아이디
  const oid = mid + '_' + Date.now(); // 가맹점 주문번호(가맹점에서 직접 설정)
  const price = '10'; // 결제금액
  const timestamp = new Date().getTime(); // 타임스템프 [TimeInMillis(Long형)]

  const signKey = INICS_SIGN_KEY;
  const mKey = crypto.createHash('sha256').update(signKey).digest('hex'); // SHA256 Hash값 [대상: mid와 매칭되는 signkey]
  const use_chkfake = 'Y';
  const signature = crypto
    .createHash('sha256')
    .update('oid=' + oid + '&price=' + price + '&timestamp=' + timestamp)
    .digest('hex'); //SHA256 Hash값 [대상: oid, price, timestamp]
  const verification = crypto
    .createHash('sha256')
    .update(
      'oid=' +
        oid +
        '&price=' +
        price +
        '&signKey=' +
        signKey +
        '&timestamp=' +
        timestamp,
    )
    .digest('hex'); //SHA256 Hash값 [대상: oid, price, signkey, timestamp]

  res.render('INIstdpay_pc_req.html', {
    mid: mid,
    oid: oid,
    price: price,
    timestamp: timestamp,
    mKey: mKey,
    use_chkfake: use_chkfake,
    signature: signature,
    verification: verification,
    inicsWebUrl: INICS_WEB_URL,
  });
});

app.post('/INIstdpay_pc_return.ejs', (req, res) => {
  // 인증 결과 성공 시
  console.log('PREPARE 전달 받은 데이터', req.body);
  if (req.body.resultCode === '0000') {
    const mid = req.body.mid || P_MID; // 상점아이디
    const signKey = INICS_SIGN_KEY;
    const authToken = req.body.authToken; // 승인요청 검증 토큰
    const netCancelUrl = req.body.netCancelUrl; // 망취소요청 Url
    const merchantData = req.body.merchantData; // goodsId=1234567890 상품번호
    const timestamp = new Date().getTime(); // 타임스템프 [TimeInMillis(Long형)]
    const charset = 'UTF-8'; // 리턴형식[UTF-8,EUC-KR](가맹점 수정후 고정)
    const format = 'JSON'; // 리턴형식[XML,JSON,NVP](가맹점 수정후 고정)

    const idc_name = req.body.idc_name;
    const authUrl = req.body.authUrl; // 승인요청 Url
    const authUrl2 = getUrl.getAuthUrl(idc_name);

    // SHA256 Hash값 [대상: authToken, timestamp]
    const signature = crypto
      .createHash('sha256')
      .update('authToken=' + authToken + '&timestamp=' + timestamp)
      .digest('hex');

    // SHA256 Hash값 [대상: authToken, signKey, timestamp]
    const verification = crypto
      .createHash('sha256')
      .update(
        'authToken=' +
          authToken +
          '&signKey=' +
          signKey +
          '&timestamp=' +
          timestamp,
      )
      .digest('hex');

    //결제 승인 요청
    let options = {
      mid: mid,
      authToken: authToken,
      timestamp: timestamp,
      signature: signature,
      verification: verification,
      charset: charset,
      format: format,
    };
    const goodsId = merchantData.split('=')[1]; // 상품번호

    if (authUrl == authUrl2) {
      // to.가람
      // /api/v1/payment/log type:prepare 호출 후 결제 처리
      request.post(
        { method: 'POST', uri: authUrl2, form: options, json: true },
        (err, httpResponse, body) => {
          try {
            let jsoncode = err ? err : JSON.stringify(body);

            let result = JSON.parse(jsoncode);

            console.log('result', result);
            res.render('INIstdpay_pc_return.ejs', {
              resultCode: result.resultCode,
              resultMsg: result.resultMsg,
              tid: result.tid,
              MOID: result.MOID,
              TotPrice: result.TotPrice,
              goodName: result.goodName,
              applDate: result.applDate,
              applTime: result.applTime,
              goodsId,
            });

            // to.가람
            // 결제처리 완료후 /api/v1/payment/provide api 호출하여 결제처리 완료 처리
            // 에러 발생시 망취소 처리(아래 참고)
          } catch (e) {
            // to.가람
            /*
              가맹점에서 승인결과 전문 처리 중 예외발생 시 망취소 요청할 수 있습니다.
              승인요청 전문과 동일한 스펙으로 진행되며, 인증결과 수신 시 전달받은 "{인증결과 전달된 P_REQ_URL의 HOST}/smart/payNetCancel.ini" 로 망취소요청합니다.
        
              ** 망취소를 일반 결제취소 용도로 사용하지 마십시오.
              일반 결제취소는 INIAPI 취소/환불 서비스를 통해 진행해주시기 바랍니다.
            */
            console.log(e);
            const netCancelUrl2 = getUrl.getNetCancel(idc_name);
            if (netCancelUrl == netCancelUrl2) {
              request.post(
                {
                  method: 'POST',
                  uri: netCancelUrl2,
                  form: options,
                  json: true,
                },
                (err, httpResponse, body) => {
                  let result = err ? err : JSON.stringify(body);

                  console.log('<p>' + result + '</p>');
                },
              );
              // to.가람
              // 취소처리후 /api/v1/payment/log type:cancel 호출
            }
          }
        },
      );
    }
  } else {
    res.render('INIstdpay_pc_return.ejs', {
      resultCode: req.body.resultCode,
      resultMsg: req.body.resultMsg,
      tid: req.body.tid,
      MOID: req.body.MOID,
      TotPrice: req.body.TotPrice,
      goodName: req.body.goodName,
      applDate: req.body.applDate,
      applTime: req.body.applTime,
    });
  }
});

app.get('/close', (req, res) => {
  res.send(
    `<script language="javascript" type="text/javascript" src="${INICS_WEB_CLOSE_URL}" charset="UTF-8"></script>`,
  );
});

const PORT = process.env.PG_PORT || 3000;
app.listen(PORT, (err) => {
  if (err) return console.log(err);
  console.log(`The server is listening on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
