import { EventEmitter } from 'node:events';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

/** يستخرج رابط الصورة الشخصية من كائن المستخدم (يدعم أشكال بيانات مختلفة للمكتبة) */
function pickAvatar(u) {
  if (!u) return '';
  if (typeof u.profilePictureUrl === 'string') return u.profilePictureUrl;
  for (const key of ['avatarThumb', 'avatarMedium', 'avatarLarge', 'profilePicture']) {
    const list = u[key]?.urlList || u[key]?.url;
    if (Array.isArray(list) && list.length) return list[0];
  }
  return '';
}

/** نص التعليق: الإصدار 2 من المكتبة يضعه في content، والإصدارات القديمة في comment */
export function commentText(data = {}) {
  return String(data.content ?? data.comment ?? '');
}

export function normalizeUser(u = {}) {
  const uniqueId = u.uniqueId || u.displayId || '';
  const id = String(u.userId || u.id || uniqueId || '');
  return {
    id,
    uniqueId: uniqueId || id,
    nickname: u.nickname || uniqueId || 'لاعب',
    avatar: pickAvatar(u),
  };
}

/** أول رابط صورة من ImageModel أو حقول المكتبة القديمة */
function imageUrl(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  const list = img.urlList || img.url_list || img.url;
  return Array.isArray(list) && list.length ? list[0] : '';
}

/**
 * يوحّد بيانات الهدية بين إصدارات المكتبة.
 * الهدايا المتتالية (combo، type = 1) تُرسل عدة رسائل أثناء السلسلة؛ نحتسبها مرة واحدة عند repeatEnd.
 * @returns {{id:number, name:string, diamonds:number, count:number, coins:number, image:string, streaking:boolean}}
 */
export function normalizeGift(data = {}) {
  const d = data.giftDetails || {};
  const ext = data.extendedGiftInfo || {};
  const type = d.type ?? data.giftType ?? ext.type ?? 0;
  const diamonds = Number(d.diamondCount ?? data.diamondCount ?? ext.diamond_count ?? ext.diamondCount ?? 0) || 0;
  const count = Math.max(1, Number(data.repeatCount) || 1);
  return {
    id: Number(data.giftId ?? d.id ?? 0),
    name: d.name || data.giftName || ext.name || 'هدية',
    diamonds,
    count,
    coins: diamonds * count,
    image: imageUrl(d.image) || imageUrl(d.icon) || data.giftPictureUrl || imageUrl(ext.image) || '',
    streaking: Number(type) === 1 && !data.repeatEnd,
  };
}

/**
 * غلاف بسيط حول tiktok-live-connector يعيد الاتصال تلقائياً عند الانقطاع.
 * الأحداث: 'comment' ({user, text}), 'gift' ({user, gift}), 'like' ({user, count}),
 * 'follow' ({user}), 'share' ({user}), 'status' ({state, message, roomId?})
 */
export class TikTokSource extends EventEmitter {
  constructor({ signApiKey } = {}) {
    super();
    this.signApiKey = signApiKey || undefined;
    this.connection = null;
    this.username = '';
    this.state = 'idle'; // idle | connecting | connected | error
    this.message = '';
    this.reconnectTimer = null;
    this.wanted = false;
  }

  status() {
    return { state: this.state, message: this.message, username: this.username };
  }

  setStatus(state, message = '') {
    this.state = state;
    this.message = message;
    this.emit('status', this.status());
  }

  async connect(username) {
    await this.disconnect();
    this.username = String(username || '').trim().replace(/^@/, '');
    if (!this.username) {
      this.setStatus('error', 'لم يتم إدخال اسم الحساب');
      return;
    }
    this.wanted = true;
    await this.open();
  }

  async open() {
    if (!this.wanted) return;
    this.setStatus('connecting', `جارٍ الاتصال بـ @${this.username} ...`);

    const conn = new TikTokLiveConnection(this.username, {
      signApiKey: this.signApiKey,
      processInitialData: false,
    });
    this.connection = conn;

    conn.on(WebcastEvent.CHAT, (data) => {
      const user = normalizeUser(data.user || data);
      if (!user.id) return;
      const text = commentText(data);
      if (!text && !this.warnedEmpty) {
        this.warnedEmpty = true;
        console.warn('[TikTok] وصل تعليق بدون نص. الحقول الموجودة:', Object.keys(data || {}).join(', '));
      }
      this.emit('comment', { user, text });
    });

    conn.on(WebcastEvent.GIFT, (data) => {
      const user = normalizeUser(data.user || data);
      const gift = normalizeGift(data);
      if (!user.id || gift.streaking) return;
      this.emit('gift', { user, gift });
    });

    conn.on(WebcastEvent.LIKE, (data) => {
      const user = normalizeUser(data.user || data);
      if (!user.id) return;
      this.emit('like', { user, count: Number(data.count ?? data.likeCount) || 1 });
    });

    conn.on(WebcastEvent.FOLLOW, (data) => {
      const user = normalizeUser(data.user || data);
      if (user.id) this.emit('follow', { user });
    });

    conn.on(WebcastEvent.SHARE, (data) => {
      const user = normalizeUser(data.user || data);
      if (user.id) this.emit('share', { user });
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (this.connection !== conn) return;
      this.setStatus('error', 'انقطع الاتصال — إعادة المحاولة بعد 10 ثوانٍ');
      this.scheduleReconnect();
    });

    conn.on(WebcastEvent.STREAM_END, () => {
      if (this.connection !== conn) return;
      this.setStatus('error', 'انتهى البث — إعادة المحاولة بعد 10 ثوانٍ');
      this.scheduleReconnect();
    });

    conn.on(ControlEvent.ERROR, (err) => {
      console.warn('[TikTok] خطأ:', err?.info || err?.exception?.message || err);
    });

    try {
      const state = await conn.connect();
      if (this.connection !== conn) return;
      this.setStatus('connected', `متصل بـ @${this.username} (roomId: ${state.roomId})`);
    } catch (err) {
      if (this.connection !== conn) return;
      const msg = err?.message || String(err);
      const offline = /offline|online|not live|UserOffline|Room ID/i.test(msg) || err?.name === 'UserOfflineError';
      this.setStatus('error', offline
        ? `الحساب @${this.username} ليس في بث مباشر الآن — إعادة المحاولة بعد 10 ثوانٍ`
        : `فشل الاتصال: ${msg} — إعادة المحاولة بعد 10 ثوانٍ`);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.wanted || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 10_000);
  }

  async disconnect() {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const conn = this.connection;
    this.connection = null;
    if (conn) {
      // المستمعون محميّون بشرط (this.connection !== conn) فلا حاجة لإزالتهم
      try { await conn.disconnect(); } catch { /* تجاهل */ }
    }
    this.setStatus('idle', 'غير متصل');
  }
}
