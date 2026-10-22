/* Blue Sky Hotel - Mobile Prototype
   Aplikasi statis (tanpa build). Data disimpan di localStorage browser. */
(function () {
  'use strict';

  /* ---------- Util ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const nights = (a, b) => Math.round((dUTC(b) - dUTC(a)) / 864e5);
  const fmtD = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${BULAN[m - 1]} ${y}`; };
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'TS';

  const STATUS = {
    pending: ['Menunggu Konfirmasi', 's-pending'],
    confirmed: ['Terkonfirmasi', 's-confirmed'],
    checkedin: ['Checked-In', 's-checkedin'],
    checkedout: ['Checked-Out', 's-checkedout'],
    cancelled: ['Dibatalkan', 's-cancelled'],
  };
  const ROOM_STATUS = { ok: ['Tersedia', 's-ok'], occ: ['Terisi (Occupied)', 's-occ'], mnt: ['Maintenance', 's-mnt'], off: ['Nonaktif', 's-off'] };

  const TIERS = {
    standard: {
      label: 'STANDARD', photo: 'standard.jpg', rating: 4.5, bed: 'Double Bed', size: '28 m²', view: 'City View',
      desc: 'Kamar nyaman serba praktis dengan fasilitas lengkap modern.', tags: ['Free Wi-Fi', 'Smart TV 40"', 'Breakfast'],
    },
    vip: {
      label: 'VIP SUITE', photo: 'vip.jpg', rating: 4.9, bed: 'King Size', size: '65 m²', view: 'Ocean Panoramic',
      desc: 'Pemandangan laut memukau, ruang luas, layanan VIP istimewa.', tags: ['Private Jacuzzi', 'Airport Shuttle', 'VIP Lounge'],
    },
  };

  /* ---------- Data & penyimpanan ---------- */
  const KEY = 'bsh_state_v1';
  const seed = () => ({
    rooms: [
      { id: 'STD-101', name: 'Standard Room (Type A)', catalogName: 'Standard Modern Room', tier: 'standard', price: 450000, status: 'ok' },
      { id: 'VIP-201', name: 'VIP Executive Ocean Suite', catalogName: 'VIP Executive Ocean Suite', tier: 'vip', price: 1250000, status: 'occ' },
    ],
    bookings: [
      { code: 'BSH-8821', name: 'M. Afredo Dwi Setiawan', phone: '081234567890', roomId: 'VIP-201', checkIn: '2026-10-24', checkOut: '2026-10-26', guests: 2, pay: 'Transfer Bank (VA)', note: '', total: 2500000, status: 'pending', mine: true },
      { code: 'BSH-7740', name: 'Belgis Putri Alfiyah', phone: '085711223344', roomId: 'STD-101', checkIn: '2026-10-23', checkOut: '2026-10-25', guests: 2, pay: 'QRIS', note: '', total: 900000, status: 'confirmed', mine: false },
      { code: 'BSH-6612', name: 'Naila Indriani', phone: '081988776655', roomId: 'VIP-201', checkIn: '2026-10-20', checkOut: '2026-10-22', guests: 2, pay: 'Kartu Kredit', note: '', total: 2500000, status: 'checkedout', mine: false },
    ],
    occupied: 8,
    capacity: 10,
    audit: [],
    nextNo: 9000,
  });
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.rooms) return s; } catch (e) {} return seed(); };
  let DB = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} };

  /* Sesi & UI state (sessionStorage agar tiap tab/perangkat bisa berbeda peran) */
  const SKEY = 'bsh_session_v1';
  const loadS = () => { try { return JSON.parse(sessionStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } };
  const S = Object.assign({ role: null, view: 'login', loginTab: 'guest', checkIn: '2026-10-24', checkOut: '2026-10-26', q: '', pick: null, voucher: null, filter: 'all', form: null }, loadS());
  const saveS = () => { try { sessionStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} };

  const roomById = (id) => DB.rooms.find((r) => r.id === id);
  const bookable = () => DB.rooms.filter((r) => r.status === 'ok' || r.status === 'occ');

  /* ---------- Navigasi ---------- */
  const GUEST_TABS = [['catalog', 'Katalog', 'building'], ['compare', 'Komparasi', 'compare'], ['orders', 'Pesanan Saya', 'receipt'], ['toAdmin', 'Mode Admin', 'user']];
  const ADMIN_TABS = [['adminDash', 'Dashboard', 'dash'], ['adminRes', 'Reservasi', 'list'], ['adminRooms', 'Kamar', 'bed'], ['toGuest', 'Mode Tamu', 'user']];
  const TAB_GROUP = { catalog: 'catalog', compare: 'compare', form: 'compare', orders: 'orders', adminDash: 'adminDash', adminRes: 'adminRes', adminRooms: 'adminRooms' };

  function go(view) {
    if (view === 'toAdmin') {
      if (S.role === 'admin') view = 'adminDash';
      else { S.loginTab = 'admin'; S.role = null; view = 'login'; }
    } else if (view === 'toGuest') {
      S.role = 'guest'; view = 'catalog';
    }
    S.view = view; saveS(); render();
    $('#screen').scrollTop = 0;
  }
  function logout() { S.role = null; S.view = 'login'; S.loginTab = 'guest'; saveS(); render(); toast('Anda telah keluar'); }

  /* ---------- Komponen ---------- */
  const header = ({ title, sub, back, right, brand = true }) => `
    <header class="hdr">
      ${brand ? `<div class="brand"><img src="logo.png" alt=""><span>Blue Sky Hotel</span><span class="sp"></span>${right || ''}</div>` : ''}
      <div class="row">${back ? `<button class="back" data-go="${back}" aria-label="Kembali">${ic('back')}</button>` : ''}<h1>${esc(title)}</h1></div>
      ${sub ? `<p>${sub}</p>` : ''}
    </header>`;
  const badge = (st) => `<span class="badge ${STATUS[st][1]}">${STATUS[st][0]}</span>`;

  /* ---------- Layar ---------- */
  function vLogin() {
    const admin = S.loginTab === 'admin';
    return `<div class="login">
      <div class="logo"><img src="logo.png" alt="Logo Blue Sky Hotel"></div>
      <h1>BLUE SKY HOTEL</h1><div class="tag">Luxury Stay Above The Clouds</div>
      <form class="card" id="loginForm" novalidate>
        <h2>Masuk</h2><p class="sub">Pilih hak akses lalu isi akun untuk melanjutkan.</p>
        <div class="seg" role="tablist"><button type="button" data-lt="guest" class="${admin ? '' : 'on'}">Tamu</button><button type="button" data-lt="admin" class="${admin ? 'on' : ''}">Admin</button></div>
        <label class="f" for="em">Email / ID Pengguna</label>
        <div class="in">${ic('mail')}<input id="em" type="text" autocomplete="username" value="${admin ? 'resepsionis@bluesky.com' : 'Afredo@bluesky.com'}"></div>
        <label class="f" for="pw">Kata Sandi</label>
        <div class="in">${ic('lock')}<input id="pw" type="password" autocomplete="current-password" value="12345678"></div>
        <div class="errmsg" id="loginErr"></div>
        <button class="btn" type="submit" style="margin-top:8px">Masuk Aplikasi &nbsp;→</button>
      </form>
      <p class="hint">Butuh bantuan? Hubungi Resepsionis</p>
      <div class="foot">Blue Sky Hotel &nbsp;·&nbsp; Prototype</div>
    </div>`;
  }

  function roomCard(r, i) {
    const t = TIERS[r.tier];
    const rec = r.tier === 'vip';
    const fts = t.tags.map((x, k) => `<span class="${rec ? 'g' : ''}">${esc(x)}</span>`).join('');
    return `<article class="card room ${rec ? 'rec' : ''}">
      <div class="ph"><img src="${t.photo}" alt="${esc(r.catalogName)}" loading="lazy">
        <span class="chip l">${t.label}</span>${rec ? '<span class="chip r">RECOMMENDED</span>' : ''}
        <span class="price">${rp(r.price)} <small>/malam</small></span></div>
      <div class="bd"><div class="tt"><h3>${esc(r.catalogName || r.name)}</h3><span class="rate">★ ${t.rating}</span></div>
        <p>${t.desc}</p><div class="tags">${fts}</div>
        <button class="btn ${rec ? '' : 'navy'}" data-book="${esc(r.id)}">${rec ? 'Pesan VIP Suite' : 'Pesan Kamar Ini &nbsp;›'}</button></div>
    </article>`;
  }

  function vCatalog() {
    const q = S.q.trim().toLowerCase();
    const list = bookable().filter((r) => !q || (r.name + ' ' + r.catalogName + ' ' + TIERS[r.tier].label + ' ' + TIERS[r.tier].tags.join(' ')).toLowerCase().includes(q));
    const nm = nights(S.checkIn, S.checkOut);
    return `${header({ title: 'Cari & Pesan Kamar', sub: 'Selamat datang, Tamu Hotel', right: `<button class="avatar" data-act="logout" title="Keluar" aria-label="Keluar">TS</button>` })}
    <div class="content" style="padding-top:0">
      <div class="card search-card">
        <div class="dates">
          <label class="dbox"><span>CHECK-IN</span><input type="date" id="ci" value="${S.checkIn}"></label>
          <label class="dbox"><span>CHECK-OUT</span><input type="date" id="co" value="${S.checkOut}" min="${S.checkIn}"></label>
        </div>
        <div class="srow"><div class="in">${ic('search')}<input id="q" type="search" placeholder="Cari tipe/fasilitas..." value="${esc(S.q)}"></div>
          <button class="btn out sm" style="height:40px" data-go="compare">Compare</button></div>
      </div>
      <div class="sec-h"><b>PILIHAN TIPE KAMAR</b><span>${list.length} Tipe Tersedia${nm > 0 ? ` · ${nm} malam` : ''}</span></div>
      ${list.length ? list.map(roomCard).join('') : '<div class="empty">Tidak ada kamar yang cocok dengan pencarian.</div>'}
    </div>`;
  }

  function vCompare() {
    const a = DB.rooms.find((r) => r.tier === 'standard' && r.status !== 'off') || DB.rooms.find((r) => r.tier === 'standard');
    const b = DB.rooms.find((r) => r.tier === 'vip' && r.status !== 'off') || DB.rooms.find((r) => r.tier === 'vip');
    const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'jt' : Math.round(n / 1000) + 'rb');
    const row = (l, x, y) => `<tr><td>${l}</td><td>${x}</td><td>${y}</td></tr>`;
    return `${header({ title: 'Komparasi Kamar', sub: 'Bandingkan fasilitas Standard & VIP Suite', back: 'catalog' })}
    <div class="content">
      <table class="cmp"><thead><tr><th>Fitur</th><th>Standard</th><th>VIP Suite</th></tr></thead><tbody>
        ${row('Harga / Malam', a ? k(a.price) : '-', b ? k(b.price) : '-')}
        ${row('Tipe Bed', TIERS.standard.bed, TIERS.vip.bed)}
        ${row('Luas Kamar', TIERS.standard.size, TIERS.vip.size)}
        ${row('Pemandangan', TIERS.standard.view, `<span class="y">${TIERS.vip.view}</span>`)}
        ${row('Sarapan', '<span class="y">✓</span> Buffet', '<span class="y">✓ Exec Buffet</span>')}
        ${row('Jacuzzi', '<span class="n">✕</span>', '<span class="y">✓ Private</span>')}
        ${row('Airport Shuttle', '<span class="n">✕</span>', '<span class="y">✓ Free Pick</span>')}
      </tbody></table>
      <div class="two"><button class="btn sec" style="height:54px" ${a ? `data-book="${esc(a.id)}"` : 'disabled'}>Pilih Standard</button>
        <button class="btn" style="height:54px" ${b ? `data-book="${esc(b.id)}"` : 'disabled'}>Pilih VIP Suite</button></div>
    </div>`;
  }

  function formState() {
    if (!S.form) S.form = { name: 'M. Afredo Dwi Setiawan', phone: '081234567890', guests: '2', pay: 'Transfer Bank (VA)', note: '' };
    return S.form;
  }
  function vForm() {
    const r = roomById(S.pick) || bookable()[0];
    if (!r) return `${header({ title: 'Formulir Reservasi', back: 'catalog' })}<div class="content empty">Belum ada kamar tersedia.</div>`;
    S.pick = r.id;
    const f = formState(); const nm = Math.max(nights(S.checkIn, S.checkOut), 0);
    const opt = (arr, v) => arr.map((x) => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
    return `${header({ title: 'Formulir Reservasi', sub: 'Lengkapi data pemesanan kamar', back: 'catalog' })}
    <form class="content" id="bookForm" novalidate>
      <div class="sel"><div class="tx"><small>TIPE DIPILIH</small><b>${esc(r.tier === 'vip' ? 'VIP Suite Room' : 'Standard Room')}</b><em>${rp(r.price)} / malam</em></div>${ic('building')}</div>
      <label class="f" for="fn">Nama Lengkap Tamu</label><div class="in" id="w-fn"><input id="fn" value="${esc(f.name)}" autocomplete="name"></div>
      <label class="f" for="fp">Nomor WhatsApp / HP</label><div class="in" id="w-fp"><input id="fp" type="tel" inputmode="tel" value="${esc(f.phone)}"></div>
      <div class="grid2">
        <div><label class="f" for="fci">Tanggal Check-In</label><div class="in"><input id="fci" type="date" value="${S.checkIn}"></div></div>
        <div><label class="f" for="fco">Tanggal Check-Out</label><div class="in" id="w-co"><input id="fco" type="date" value="${S.checkOut}" min="${S.checkIn}"></div></div>
        <div><label class="f" for="fg">Jumlah Tamu</label><div class="in"><select id="fg">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${String(n) === f.guests ? 'selected' : ''}>${n} Tamu</option>`).join('')}</select></div></div>
        <div><label class="f" for="fpay">Metode Pembayaran</label><div class="in"><select id="fpay">${opt(['Transfer Bank (VA)', 'QRIS', 'Kartu Kredit', 'Bayar di Hotel'], f.pay)}</select></div></div>
      </div>
      <label class="f" for="fnote">Permintaan Khusus (Opsional)</label>
      <div class="in ta"><textarea id="fnote" placeholder="Contoh: Bebas asap rokok, Check-in awal, dekorasi ulang tahun...">${esc(f.note)}</textarea></div>
      <div class="total"><div><small>Total Pembayaran (${nm} Malam)</small><b id="tot">${rp(nm * r.price)}</b></div><span class="tag-g">Pajak Included</span></div>
      <div class="errmsg" id="formErr"></div>
      <button class="btn" type="submit" style="height:52px">Konfirmasi &amp; Buat Pemesanan</button>
    </form>`;
  }

  function vOrders() {
    const mine = DB.bookings.filter((b) => b.mine);
    if (!mine.length) return `${header({ title: 'Status & E-Voucher', sub: '<span class="live">Realtime Live</span> &nbsp;•&nbsp; Pantau pemesananmu' })}<div class="empty" style="padding-top:60px">Belum ada pesanan.<br><br><button class="btn sm" data-go="catalog">Pesan Kamar</button></div>`;
    const cur = mine.find((b) => b.code === S.voucher) || mine[0];
    S.voucher = cur.code;
    const r = roomById(cur.roomId); const tier = r ? (r.tier === 'vip' ? 'VIP Suite' : 'Standard') : '-';
    const chips = mine.length > 1 ? `<div class="chips">${mine.map((b) => `<button class="fchip ${b.code === cur.code ? 'on' : ''}" data-voucher="${b.code}">${b.code}</button>`).join('')}</div>` : '';
    return `${header({ title: 'Status & E-Voucher', sub: '<span class="live">Realtime Live</span> &nbsp;•&nbsp; Pantau pemesananmu' })}${chips}
    <section class="card vcard" id="voucher">
      <span class="stat ${STATUS[cur.status][1]}">${STATUS[cur.status][0]}</span>
      <div class="code-l">Kode Booking Resmi</div><div class="code">${cur.code}</div>
      <div class="kv"><span>Nama Pemesan</span><b>${esc(cur.name)}</b></div>
      <div class="kv"><span>Tipe Kamar</span><b>${tier}</b></div>
      <div class="kv"><span>Tanggal Menginap</span><b>${cur.checkIn} s/d ${cur.checkOut}</b></div>
      <div class="kv"><span>Total Pembayaran</span><b class="bl">${rp(cur.total)}</b></div>
      <div class="qrbox"><div class="qr" id="qr"></div><p>Tunjukkan QR Code ini saat Check-In di resepsionis</p></div>
      <button class="btn sec no-print" style="margin-top:14px" data-act="print">Simpan / Cetak E-Voucher</button>
    </section>`;
  }

  function vAdminDash() {
    const active = DB.bookings.filter((b) => ['pending', 'confirmed', 'checkedin'].includes(b.status));
    const rev = active.reduce((s, b) => s + b.total, 0);
    const pend = DB.bookings.filter((b) => b.status === 'pending').length;
    const pct = Math.round((DB.occupied / DB.capacity) * 100);
    const money = rev >= 1e6 ? 'Rp ' + (rev / 1e6).toFixed(1).replace('.', ',') + ' jt' : rp(rev);
    const recent = DB.bookings.slice(0, 2);
    return `${header({ title: 'Dashboard Admin', sub: 'PANEL PENGELOLA', right: `<button class="pill-h amber" data-act="logout" title="Keluar">Resepsionis</button>` })}
    <div class="content">
      <div class="stats">
        <div class="card st"><div class="a">KAMAR TERISI ${ic('bed')}</div><div class="v">${DB.occupied} / ${DB.capacity}</div><div class="d g">↑ ${pct}% Occupancy</div></div>
        <div class="card st"><div class="a">PENDAPATAN ${ic('money')}</div><div class="v">${money}</div><div class="d">Est. Transaksi Aktif</div></div>
        <div class="card st o"><div class="a">PENDING BOOKING ${ic('clock')}</div><div class="v">${pend}</div><div class="d o">${pend ? 'Perlu Konfirmasi' : 'Semua beres'}</div></div>
        <div class="card st"><div class="a">TOTAL RESERVASI ${ic('doc')}</div><div class="v">${DB.bookings.length}</div><div class="d">Data Tersimpan Lokal</div></div>
      </div>
      <div class="card quick"><h3>Aksi Cepat Manager</h3><div class="qg"><button class="qb" data-go="adminRes">Kelola Reservasi</button><button class="qb alt" data-go="adminRooms">Atur Data Kamar</button></div></div>
      <div class="sec-h"><b style="font-size:14px;letter-spacing:0">Reservasi Terbaru</b><span data-go="adminRes" style="cursor:pointer">Lihat Semua</span></div>
      ${recent.map((b) => `<div class="card rr"><div class="t"><b class="c">${b.code}</b><b class="n">${esc(b.name)}</b></div>
        <div class="b"><span>${esc((roomById(b.roomId) || {}).tier === 'vip' ? 'VIP Suite' : 'Standard Room')} &nbsp;•&nbsp; ${b.checkIn}</span><button class="btn navy sm" data-status="${b.code}">Ubah Status</button></div></div>`).join('')}
    </div>`;
  }

  function vAdminRes() {
    const f = S.filter;
    const cnt = DB.bookings.length;
    const list = DB.bookings.filter((b) => f === 'all' || b.status === f);
    const F = [['all', 'Semua', 'all'], ['pending', 'Pending', 'f-pending'], ['confirmed', 'Terkonfirmasi', 'f-confirmed'], ['checkedin', 'Check-In', 'f-checkedin']];
    return `${header({ title: 'Daftar Reservasi', sub: 'Kelola status pemesanan tamu', back: 'adminDash', right: `<span class="pill-h">${cnt} Total</span>` })}
    <div class="filters">${F.map(([k, l, c]) => `<button class="fchip ${c} ${f === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
    <div class="content">${list.length ? list.map((b) => {
      const r = roomById(b.roomId);
      return `<article class="card res"><div class="h"><div><small>${b.code}</small><b>${esc(b.name)}</b></div>${badge(b.status)}</div>
        <div class="info"><div>${ic('bed')}${r && r.tier === 'vip' ? 'VIP Suite' : 'Standard Room'}</div><div>${ic('cal')}${b.checkIn} s/d ${b.checkOut}</div><div>${ic('phone')}${esc(b.phone)}</div></div>
        <div class="f"><b>${rp(b.total)}</b><button class="btn navy sm" data-status="${b.code}">Kelola Status</button></div></article>`;
    }).join('') : '<div class="empty">Tidak ada reservasi pada filter ini.</div>'}</div>`;
  }

  function vAdminRooms() {
    return `${header({ title: 'Kelola Data Kamar', sub: 'Inventaris dan harga kamar', back: 'adminDash', right: `<button class="pill-h" data-room="new">+ Kamar Baru</button>` })}
    <div class="content">${DB.rooms.map((r) => {
      const s = ROOM_STATUS[r.status];
      const mntLbl = r.status === 'mnt' ? 'Aktifkan' : 'Maintenance';
      const offLbl = r.status === 'off' ? 'Aktifkan' : 'Nonaktifkan';
      const second = r.tier === 'vip' ? `<button class="btn g sm" data-roomact="off:${esc(r.id)}">${offLbl}</button>` : `<button class="btn g sm" data-roomact="mnt:${esc(r.id)}">${mntLbl}</button>`;
      return `<article class="card rm ${r.status === 'occ' ? 'occ' : ''}"><div class="h"><span class="cd">${esc(r.id)}</span><span class="badge ${s[1]}">${s[0]}</span></div>
        <h3>${esc(r.name)}</h3><hr><div class="f"><b>${rp(r.price)} <small style="font-weight:400;color:var(--mut)">/malam</small></b>
        <div class="ac"><button class="btn g sm" data-room="${esc(r.id)}">Edit</button>${second}</div></div></article>`;
    }).join('') || '<div class="empty">Belum ada kamar.</div>'}</div>`;
  }

  const VIEWS = { login: vLogin, catalog: vCatalog, compare: vCompare, form: vForm, orders: vOrders, adminDash: vAdminDash, adminRes: vAdminRes, adminRooms: vAdminRooms };

  /* ---------- Render ---------- */
  function render() {
    const adminViews = ['adminDash', 'adminRes', 'adminRooms'];
    if (S.view !== 'login' && !S.role) S.view = 'login';
    if (adminViews.includes(S.view) && S.role !== 'admin') S.view = 'login';
    if (S.role === 'admin' && !adminViews.includes(S.view)) S.view = 'adminDash';
    $('#screen').innerHTML = VIEWS[S.view]();
    const tb = $('#tabbar');
    if (S.view === 'login') { tb.className = 'tabbar'; tb.innerHTML = ''; }
    else {
      const tabs = S.role === 'admin' ? ADMIN_TABS : GUEST_TABS;
      const grp = TAB_GROUP[S.view];
      tb.className = 'tabbar show';
      tb.innerHTML = tabs.map(([k, l, i]) => `<button data-go="${k}" class="${k === grp ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('');
    }
    if (S.view === 'orders') drawQR();
  }

  function drawQR() {
    const el = $('#qr'); if (!el) return;
    try {
      const qr = window.qrcode(0, 'M'); qr.addData('BLUESKY|' + S.voucher); qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { el.innerHTML = '<svg class="i" style="width:100px;height:100px;color:#1E293B"><use href="#i-qr"/></svg>'; }
  }

  /* ---------- Modal & toast ---------- */
  function openModal(html) { $('#modal-root').innerHTML = `<div class="ov" data-close="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; }
  function closeModal() { $('#modal-root').innerHTML = ''; }
  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200); }

  function statusModal(code) {
    const b = DB.bookings.find((x) => x.code === code); if (!b) return;
    const o = (st, cls, icon, label, ok) => `<button class="opt ${cls}" data-setstatus="${st}" data-code="${code}" ${ok ? '' : 'disabled'}><span>${label}</span>${ic(icon)}</button>`;
    const s = b.status; const open = !['checkedout', 'cancelled'].includes(s);
    openModal(`<div class="sh"><div><h3>Perbarui Status Reservasi</h3><div class="id">#${code}</div></div><button class="x" data-close="1" aria-label="Tutup">${ic('close')}</button></div>
      <p class="sub" style="margin:6px 0 4px">Status saat ini: ${badge(s)}<br><br>Pilih status baru sesuai hak wewenang resepsionis/admin:</p>
      ${o('confirmed', 'o-ok', 'check', 'Set “Terkonfirmasi”', s === 'pending')}
      ${o('checkedin', 'o-in', 'key', 'Set “Checked-In” (Tamu Tiba)', s === 'pending' || s === 'confirmed')}
      ${o('checkedout', 'o-out', 'out', 'Set “Checked-Out” (Selesai)', s === 'checkedin')}
      ${o('cancelled', 'o-no', 'ban', 'Batalkan Pemesanan', open)}
      <p class="audit">Audit Log: Perubahan akan dicatat di sistem pengelola</p>`);
  }

  function applyStatus(code, st) {
    const b = DB.bookings.find((x) => x.code === code); if (!b) return;
    const prev = b.status; b.status = st;
    const r = roomById(b.roomId);
    if (st === 'checkedin') { DB.occupied = Math.min(DB.capacity, DB.occupied + 1); if (r && r.status === 'ok') r.status = 'occ'; }
    if ((st === 'checkedout' || st === 'cancelled') && prev === 'checkedin') {
      DB.occupied = Math.max(0, DB.occupied - 1);
      if (r && r.status === 'occ' && !DB.bookings.some((x) => x !== b && x.roomId === r.id && x.status === 'checkedin')) r.status = 'ok';
    }
    DB.audit.unshift({ at: new Date().toISOString(), code, from: prev, to: st, by: 'Resepsionis' });
    DB.audit = DB.audit.slice(0, 100);
    save(); closeModal(); render(); toast(`${code} → ${STATUS[st][0]}`);
  }

  function roomModal(id) {
    const isNew = id === 'new'; const r = isNew ? { id: '', name: '', tier: 'standard', price: 450000, status: 'ok' } : roomById(id);
    if (!r) return;
    openModal(`<div class="sh"><div><h3>${isNew ? 'Kamar Baru' : 'Edit Kamar'}</h3>${isNew ? '' : `<div class="id">${esc(r.id)}</div>`}</div><button class="x" data-close="1" aria-label="Tutup">${ic('close')}</button></div>
      <form id="roomForm" data-id="${esc(id)}" novalidate>
        ${isNew ? `<label class="f" for="rid">Kode Kamar</label><div class="in"><input id="rid" placeholder="mis. STD-102" value=""></div>` : ''}
        <label class="f" for="rn">Nama Kamar</label><div class="in"><input id="rn" value="${esc(r.name)}"></div>
        <div class="grid2"><div><label class="f" for="rt">Tipe</label><div class="in"><select id="rt"><option value="standard" ${r.tier === 'standard' ? 'selected' : ''}>Standard</option><option value="vip" ${r.tier === 'vip' ? 'selected' : ''}>VIP Suite</option></select></div></div>
        <div><label class="f" for="rpz">Harga / malam (Rp)</label><div class="in"><input id="rpz" type="number" min="0" step="10000" inputmode="numeric" value="${r.price}"></div></div></div>
        <div class="errmsg" id="roomErr"></div>
        <button class="btn" type="submit">Simpan</button></form>`);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-close],[data-go],[data-lt],[data-book],[data-act],[data-status],[data-setstatus],[data-filter],[data-voucher],[data-room],[data-roomact]');
    if (!t) return;
    if (t.dataset.close) { if (t.classList.contains('ov') && e.target !== t) return; if (t.classList.contains('ov') || t.classList.contains('x')) closeModal(); return; }
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.lt) { S.loginTab = t.dataset.lt; saveS(); return render(); }
    if (t.dataset.book) { S.pick = t.dataset.book; S.view = 'form'; saveS(); render(); $('#screen').scrollTop = 0; return; }
    if (t.dataset.act === 'logout') return logout();
    if (t.dataset.act === 'print') return window.print();
    if (t.dataset.status) return statusModal(t.dataset.status);
    if (t.dataset.setstatus) return applyStatus(t.dataset.code, t.dataset.setstatus);
    if (t.dataset.filter) { S.filter = t.dataset.filter; saveS(); return render(); }
    if (t.dataset.voucher) { S.voucher = t.dataset.voucher; saveS(); return render(); }
    if (t.dataset.room) return roomModal(t.dataset.room);
    if (t.dataset.roomact) {
      const [kind, id] = t.dataset.roomact.split(':'); const r = roomById(id); if (!r) return;
      if (kind === 'mnt') r.status = r.status === 'mnt' ? 'ok' : 'mnt';
      else r.status = r.status === 'off' ? 'ok' : 'off';
      save(); render(); toast(`${r.id}: ${ROOM_STATUS[r.status][0]}`);
    }
  });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'loginForm') {
      const em = $('#em').value.trim(), pw = $('#pw').value;
      if (!em || !pw) { $('#loginErr').textContent = 'Email/ID dan kata sandi wajib diisi.'; return; }
      S.role = S.loginTab === 'admin' ? 'admin' : 'guest';
      S.view = S.role === 'admin' ? 'adminDash' : 'catalog'; saveS(); render(); toast(S.role === 'admin' ? 'Masuk sebagai Resepsionis' : 'Selamat datang, Tamu Hotel');
    } else if (f.id === 'bookForm') submitBooking();
    else if (f.id === 'roomForm') submitRoom(f);
  });

  document.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'q') { S.q = e.target.value; saveS(); const pos = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
  });
  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'ci' || id === 'fci') {
      S.checkIn = e.target.value || S.checkIn;
      if (nights(S.checkIn, S.checkOut) < 1) { const d = new Date(dUTC(S.checkIn) + 864e5); S.checkOut = d.toISOString().slice(0, 10); }
      keepForm(); saveS(); render();
    } else if (id === 'co' || id === 'fco') {
      if (nights(S.checkIn, e.target.value) < 1) { toast('Check-out harus setelah check-in'); render(); return; }
      S.checkOut = e.target.value; keepForm(); saveS(); render();
    }
  });

  function keepForm() {
    if (S.view !== 'form') return;
    const f = formState();
    const g = (id) => { const el = $('#' + id); return el ? el.value : null; };
    f.name = g('fn') ?? f.name; f.phone = g('fp') ?? f.phone; f.guests = g('fg') ?? f.guests; f.pay = g('fpay') ?? f.pay; f.note = g('fnote') ?? f.note;
  }

  function submitBooking() {
    keepForm(); const f = formState(); const r = roomById(S.pick);
    const bad = (w, m) => { $('#' + w).classList.add('err'); $('#formErr').textContent = m; };
    document.querySelectorAll('.in.err').forEach((x) => x.classList.remove('err'));
    if (!r) return;
    if (f.name.trim().length < 3) return bad('w-fn', 'Nama lengkap minimal 3 karakter.');
    if (!/^(\+62|62|0)8[0-9]{7,12}$/.test(f.phone.replace(/[\s-]/g, ''))) return bad('w-fp', 'Nomor HP tidak valid (contoh: 081234567890).');
    const nm = nights(S.checkIn, S.checkOut);
    if (nm < 1) return bad('w-co', 'Tanggal check-out harus setelah check-in.');
    const code = 'BSH-' + (DB.nextNo++);
    DB.bookings.unshift({ code, name: f.name.trim(), phone: f.phone.trim(), roomId: r.id, checkIn: S.checkIn, checkOut: S.checkOut, guests: Number(f.guests), pay: f.pay, note: f.note.trim(), total: nm * r.price, status: 'pending', mine: true });
    save(); S.voucher = code; S.view = 'orders'; saveS(); render(); $('#screen').scrollTop = 0; toast('Pemesanan dibuat — menunggu konfirmasi admin');
  }

  function submitRoom(form) {
    const isNew = form.dataset.id === 'new'; const err = (m) => { $('#roomErr').textContent = m; };
    const name = $('#rn').value.trim(), price = Number($('#rpz').value), tier = $('#rt').value;
    if (!name) return err('Nama kamar wajib diisi.');
    if (!(price > 0)) return err('Harga harus lebih dari 0.');
    if (isNew) {
      const id = $('#rid').value.trim().toUpperCase();
      if (!id) return err('Kode kamar wajib diisi.');
      if (roomById(id)) return err('Kode kamar sudah dipakai.');
      DB.rooms.push({ id, name, catalogName: name, tier, price, status: 'ok' });
      DB.capacity = Math.max(DB.capacity, DB.rooms.length);
    } else {
      const r = roomById(form.dataset.id); Object.assign(r, { name, catalogName: name, tier, price });
    }
    save(); closeModal(); render(); toast('Data kamar disimpan');
  }

  /* Sinkron lintas tab (Realtime Live) */
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    DB = load();
    if (!$('#modal-root').firstChild && !['form', 'login'].includes(S.view)) render();
  });

  /* Jam status bar */
  const tick = () => { const d = new Date(); $('#clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  tick(); setInterval(tick, 30000);

  render();
})();
