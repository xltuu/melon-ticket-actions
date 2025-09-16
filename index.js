import * as core from "@actions/core";
import { IncomingWebhook } from "@slack/webhook";
import axios from "axios";
import * as qs from "querystring";

(async () => {
  // Validate parameters
  const [ productId, scheduleId, seatId, webhookUrl ] = [
    "product-id",
    "schedule-id",
    "seat-id",
    "slack-incoming-webhook-url",
  ].map((name) => {
    const value = core.getInput(name);
    if (!value) {
      throw new Error(`melon-ticket-actions: Please set ${name} input parameter`);
    }
    return value;
  });

  const message = core.getInput("message") ?? "티켓사세요";
  const webhook = new IncomingWebhook(webhookUrl);

  // --- axios 요청 부분을 아래와 같이 수정 ---
  const res = await axios({
    method: "POST", // 원래의 POST 방식 유지
    url: "https://ticket.melon.com/tktapi/product/seatStateInfo.json",
    data: qs.stringify({ // 데이터는 data 속성으로 전송
      prodId: productId,
      scheduleNo: scheduleId,
      seatId,
      volume: 1,
      selectedGradeVolume: 1,
    }),
    // 👇 봇으로 인식되지 않도록 헤더를 완벽하게 추가하는 것이 핵심
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Referer': `https://ticket.melon.com/performance/index.htm?prodId=${productId}`,
      'X-Requested-With': 'XMLHttpRequest', // AJAX 요청임을 명시
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' // 데이터 형식 명시
    }
  });

  // POST 방식의 응답은 바로 JSON이므로, 복잡한 파싱이 필요 없음
  const data = res.data;

  // tslint:disable-next-line
  console.log("Got response: ", data);

  if (data.chkResult) {
    const link = `http://ticket.melon.com/performance/index.htm?${qs.stringify({
      prodId: productId,
    })}`;

    await webhook.send(`${message} ${link}`);
  }
})().catch((e) => {
  // axios 오류 발생 시, 서버 응답 내용을 출력하여 원인 파악
  if (e.response) {
    console.error(`Error: ${e.message}`);
    console.error(`Status: ${e.response.status}`);
    console.error("Data: ", e.response.data);
    console.error("Headers: ", e.response.headers);
  } else {
    console.error(e.stack);
  }
  core.setFailed(e.message);
});
