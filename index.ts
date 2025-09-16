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

  // --- 1. JSONP 요청을 위한 callback 이름 정의 ---
  const callbackName = `jsonp_callback_${Date.now()}`;

  // --- 2. axios 요청을 GET 방식으로 수정 ---
  const res = await axios({
    method: "GET", // POST에서 GET으로 변경
    url: "https://ticket.melon.com/tktapi/product/seatStateInfo.json",
    params: {
      v: "1",
      prodId: productId,
      scheduleNo: scheduleId,
      seatId,
      callback: callbackName // JSONP를 위한 callback 파라미터 추가
    },
    // 406 오류 해결을 위한 헤더 추가
    headers: {
      'Accept': '*/*',
      'Referer': 'https://ticket.melon.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    }
  });

  // --- 3. JSONP 응답에서 순수 JSON 데이터만 파싱 ---
  let data;
  try {
    const jsonpText = res.data; // res.data는 "callback({...})" 형태의 문자열
    // 정규표현식을 사용해 괄호 안의 JSON 부분만 추출
    const match = jsonpText.match(new RegExp(`^\\s*${callbackName}\\((.*)\\)\\s*$`));
    if (!match || !match[1]) {
      throw new Error("Failed to parse JSONP response.");
    }
    data = JSON.parse(match[1]); // 추출한 문자열을 JSON 객체로 변환
  } catch (error) {
    console.error("JSONP 파싱 오류:", error);
    core.setFailed("멜론티켓 서버 응답을 파싱할 수 없습니다.");
    return;
  }

  // tslint:disable-next-line
  console.log("Got response: ", data);

  // 파싱된 data 객체를 사용해 기존 로직 수행
  if (data.chkResult) {
    const link = `http://ticket.melon.com/performance/index.htm?${qs.stringify({
      prodId: productId,
    })}`;

    await webhook.send(`${message} ${link}`);
  }
})().catch((e) => {
  console.error(e.stack); // tslint:disable-line
  core.setFailed(e.message);
});
