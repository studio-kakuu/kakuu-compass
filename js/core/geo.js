/*
 * COMPASS - 都道府県の代表座標と方位の計算
 * 代表座標 = 都道府県庁所在地(おおよその位置、小数4桁)。
 * 出典: 国土地理院「都道府県庁所在地の緯度経度」等の公開値をもとに丸めた値。
 * 方位は「地図上の北(真北)」基準。磁北への補正(西偏)はしていない。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./kyusei.js'));
  } else {
    root.Compass = root.Compass || {};
    root.Compass.geo = factory(root.Compass.kyusei);
  }
})(typeof self !== 'undefined' ? self : this, function (kyusei) {
  'use strict';

  // [名前, 緯度, 経度]
  var PREFS = [
    ['北海道', 43.0642, 141.3469], ['青森県', 40.8244, 140.7400], ['岩手県', 39.7036, 141.1527],
    ['宮城県', 38.2688, 140.8721], ['秋田県', 39.7186, 140.1024], ['山形県', 38.2404, 140.3633],
    ['福島県', 37.7503, 140.4676], ['茨城県', 36.3418, 140.4468], ['栃木県', 36.5657, 139.8836],
    ['群馬県', 36.3911, 139.0608], ['埼玉県', 35.8569, 139.6489], ['千葉県', 35.6051, 140.1233],
    ['東京都', 35.6895, 139.6917], ['神奈川県', 35.4478, 139.6425], ['新潟県', 37.9026, 139.0236],
    ['富山県', 36.6953, 137.2113], ['石川県', 36.5947, 136.6256], ['福井県', 36.0652, 136.2216],
    ['山梨県', 35.6642, 138.5684], ['長野県', 36.6513, 138.1810], ['岐阜県', 35.3912, 136.7223],
    ['静岡県', 34.9769, 138.3831], ['愛知県', 35.1802, 136.9066], ['三重県', 34.7303, 136.5086],
    ['滋賀県', 35.0045, 135.8686], ['京都府', 35.0214, 135.7556], ['大阪府', 34.6863, 135.5200],
    ['兵庫県', 34.6913, 135.1830], ['奈良県', 34.6851, 135.8329], ['和歌山県', 34.2260, 135.1675],
    ['鳥取県', 35.5039, 134.2377], ['島根県', 35.4723, 133.0505], ['岡山県', 34.6618, 133.9344],
    ['広島県', 34.3966, 132.4596], ['山口県', 34.1859, 131.4714], ['徳島県', 34.0658, 134.5593],
    ['香川県', 34.3401, 134.0434], ['愛媛県', 33.8417, 132.7661], ['高知県', 33.5597, 133.5311],
    ['福岡県', 33.6064, 130.4181], ['佐賀県', 33.2494, 130.2988], ['長崎県', 32.7448, 129.8737],
    ['熊本県', 32.7898, 130.7417], ['大分県', 33.2382, 131.6126], ['宮崎県', 31.9111, 131.4239],
    ['鹿児島県', 31.5602, 130.5581], ['沖縄県', 26.2124, 127.6809]
  ].map(function (a) { return { name: a[0], lat: a[1], lon: a[2] }; });

  function find(name) {
    for (var i = 0; i < PREFS.length; i++) if (PREFS[i].name === name) return PREFS[i];
    return null;
  }

  var R = 6371; // km
  function rad(x) { return x * Math.PI / 180; }

  /** 大圏の初期方位角(真北0°・時計回り) */
  function bearing(a, b) {
    var p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function distance(a, b) {
    var dp = rad(b.lat - a.lat), dl = rad(b.lon - a.lon);
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** 距離の目安 */
  function scaleOf(km) {
    if (km < 100) return 'near';
    if (km < 400) return 'mid';
    return 'far';
  }
  var SCALE_NAMES = { near: '近場', mid: '中距離', far: '遠方' };

  /** 現住所の都道府県から見た、各方位(宮)にある都道府県(近い順) */
  function regionsByPalace(homeName) {
    var home = find(homeName);
    var out = {};
    kyusei.PALACES.forEach(function (p) { out[p.id] = []; });
    if (!home) return out;
    PREFS.forEach(function (pf) {
      if (pf.name === home.name) return;
      var brg = bearing(home, pf);
      var km = distance(home, pf);
      out[kyusei.palaceOfBearing(brg)].push({ name: pf.name, km: Math.round(km), bearing: Math.round(brg), scale: scaleOf(km) });
    });
    Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.km - b.km; }); });
    return out;
  }

  return { PREFS: PREFS, find: find, bearing: bearing, distance: distance, regionsByPalace: regionsByPalace, scaleOf: scaleOf, SCALE_NAMES: SCALE_NAMES };
});
