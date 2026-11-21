<div align="center">

# 🚕 新加坡打车标准价

**免费、开源的新加坡打车参考价工具**

[![test](https://github.com/Shelikeit69/SG_Taxi_Price_Discovery/actions/workflows/test.yml/badge.svg)](https://github.com/Shelikeit69/SG_Taxi_Price_Discovery/actions/workflows/test.yml)
[![代码许可 MIT](https://img.shields.io/badge/代码许可-MIT-blue)](LICENSE)
[![数据许可 CC BY 4.0](https://img.shields.io/badge/数据许可-CC%20BY%204.0-lightgrey)](https://creativecommons.org/licenses/by/4.0/)
[![状态 开发中](https://img.shields.io/badge/状态-开发中-orange)](#-进度)

简体中文 | [English](README.md)

</div>

选一个起点地铁站和一个终点地铁站，工具按 ComfortDelGro 公布的普通德士费率，算出这段路在路边扬招、打表计费时大概要多少钱。拿这个数和打车软件里的报价比一比，差价值不值得付，你自己判断。

标准价只用公开费率计算，是估算，不是报价。本项目不调用、也不抓取任何打车平台的接口。

## 📍 进度

早期开发。计价公式和数据设计已经定下，标准价计算页和提交表单还没做。

仓库里现在有：

| 路径 | 内容 |
| --- | --- |
| `src/surcharge.js` | 时段倍数和附加费规则 |
| `tests/surcharge.test.js` | 这些规则的边界测试 |
| `scripts/build_data.py` | 把站点、线路和海岸线数据转成地图用的精简 JSON |
| `scripts/page_template.html` | 附加费地图页面模板（Leaflet） |
| `scripts/build_page.py` | 填充模板，生成一个不依赖外部文件的 HTML 页面 |

## 💰 计价规则

费率于 2026-11-21 对照 [ComfortDelGro 费率页](https://www.cdgtaxi.com.sg/fares/)核对。

标准价 =（起步价 + 里程费 + 等候费）×（1 + 时段附加比例）+ 地点附加费 + 市区附加费

| 项目 | 费率 |
| --- | --- |
| 起步价（首 1 公里） | $4.60（混合动力德士；电动德士 $4.80） |
| 里程费，1–10 公里 | 每 400 米 $0.27 |
| 里程费，10 公里以上 | 每 350 米 $0.27 |
| 等候费 | 每 45 秒 $0.27 |
| 高峰 | +25%：工作日 6:00–9:29，周末和公共假期 10:00–13:59，每天 17:00–23:59 |
| 深夜 | +50%：0:00–5:59 |

$0.27 里含 $0.01 的临时附加费，执行到 2027-02-28。等候时间没法实测，暂按里程费的比例估算：非高峰 10%，高峰 20%。以后会用用户提交的扬招实付价来校准。

附加费是固定金额，在乘完时段倍数之后再加，按起点站收取：

| 起点站 | 附加费 |
| --- | --- |
| Changi Airport | 17:00–23:59 收 $8.00，其他时间 $6.00 |
| Marina South Pier（去 Marina Bay Cruise Centre） | 7:00–16:59 收 $5.00，其他时间 $3.00 |
| Gardens by the Bay | $3.00 |
| Expo | $2.00 |
| 19 个市中心站（草拟清单见 `src/surcharge.js`） | 17:00–23:59 收 $3.00 |

没算进去的：ERP 电子道路收费、预订费，以及没有地铁站的地点的附加费（Mandai、Seletar Airport、Resorts World Sentosa、Tanah Merah Ferry Terminal）。

## 🧪 运行测试

```sh
node --test tests/surcharge.test.js
```

## 🗺️ 生成附加费地图

地图数据来自两个第三方仓库，它们的许可还没确认，所以数据和生成的页面都不放进本仓库。在本地生成：

```sh
git clone --depth 1 https://github.com/cheeaun/sgraildata data/raw/sgraildata
git clone --depth 1 https://github.com/yinshanyang/singapore data/raw/singapore
npm pack leaflet@1.9.4 && tar xzf leaflet-1.9.4.tgz -C data/raw

python3 scripts/build_data.py \
  data/raw/sgraildata/data/v1/sg-rail.geojson \
  data/raw/singapore/maps/0-country.geojson \
  data/raw/singapore/maps/2-planning-area.geojson \
  mapdata.json
python3 scripts/build_page.py data/raw/package/dist/leaflet.css mapdata.json build/index.html
```

用浏览器打开 `build/index.html`。

## 🔒 隐私

提交功能做好后，每条记录只存这几项：起点站、终点站、取整到 15 分钟的时间、平台、下单价格，以及一个可选的“用了优惠”标记。不存账号、手机号、设备 ID、IP 地址或定位坐标。

## 📄 许可

代码：[MIT](LICENSE)。公开发布的车费数据将采用 CC BY 4.0。
