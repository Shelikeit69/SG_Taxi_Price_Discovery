// Surcharge and time-band rules for the ComfortDelGro standard taxi fare.
// Rates checked against https://www.cdgtaxi.com.sg/fares/ on 2026-11-21.
// m = minutes after midnight (0-1439); day = "wd" (weekday) or "we" (weekend / public holiday).
// CBD is a draft list of 19 stations; CAND are 7 candidate stations not yet decided.
const CBD=["Raffles Place","Downtown","Telok Ayer","Tanjong Pagar","Shenton Way","Maxwell","Marina Bay","Bayfront","Promenade","Esplanade","City Hall","Chinatown","Clarke Quay","Fort Canning","Bras Basah","Bencoolen","Dhoby Ghaut","Somerset","Orchard"];
const CAND=["Bugis","Rochor","Jalan Besar","Little India","Farrer Park","Outram Park","Prince Edward Road"];
const LOC={
 "Changi Airport":{place:"樟宜机场",rule:"17:00–23:59 $8.00，其他时间 $6.00",f:m=>m>=1020?8:6},
 "Marina South Pier":{place:"Marina Bay Cruise Centre",rule:"7:00–16:59 $5.00，其他时间 $3.00",f:m=>(m>=420&&m<1020)?5:3},
 "Gardens by the Bay":{place:"滨海湾花园",rule:"全天 $3.00",f:m=>3},
 "Expo":{place:"Singapore Expo",rule:"全天 $2.00",f:m=>2}};
const cbdOn=m=>m>=1020;
function mult(m,day){if(m<360)return["深夜",1.5];if(m>=1020)return["高峰",1.25];if(day==="wd"&&m>=360&&m<570)return["高峰",1.25];if(day==="we"&&m>=600&&m<840)return["高峰",1.25];return["非高峰",1];}
if (typeof module !== "undefined") module.exports = { CBD, CAND, LOC, cbdOn, mult };
