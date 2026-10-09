import { EventEmitter } from 'node:events';
import { BPhase, rankTeams } from './battle.js';

const pick = (arr, random) => arr[Math.floor(random() * arr.length)];
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

/** اسم مختصر ونظيف للنطق (بدون رموز وزخارف تُربك محرك الصوت) */
export function speakName(name) {
  const clean = String(name || '')
    .replace(/[\p{Extended_Pictographic}\p{S}_|~*^#@<>[\]{}()"'`]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...clean].slice(0, 18).join('') || 'بطل';
}

/** شرح طريقة اللعب كاملاً (يُقرأ بالصوت في بداية كل ردهة) */
export function howtoText(opt) {
  const teams = opt.teams.map((t) => `${t.id} لفريق ${t.name}`).join('، ');
  const parts = [
    'أهلاً وسهلاً بكم في حرب الفرق! اللعبة اللي يقرر فيها الجمهور مين البطل!',
    `طريقة اللعب سهلة جداً: اكتب رقم فريقك في التعليقات. ${teams}.`,
    `كل تعليق منك يعطي فريقك ${opt.commentPoints} نقطة، وكل لايك ${opt.likePoints} نقطة، والمتابعة ${opt.followPoints} نقطة، والمشاركة ${opt.sharePoints} نقطة.`,
    `والهدايا هي السلاح الأقوى: كل عملة تساوي ${opt.giftPointsPerCoin} نقاط لفريقك!`,
  ];
  if (opt.boostCoins > 0) parts.push(`هدية بقيمة ${opt.boostCoins} عملة أو أكثر تشغّل المضاعف، ونقاط فريقك تتضاعف ${opt.boostSeconds} ثانية!`);
  if (opt.bombCoins > 0) parts.push(`وهدية بقيمة ${opt.bombCoins} عملة أو أكثر تفجّر قنبلة على الفريق المنافس المتصدر، ويخسر ${opt.bombPercent} بالمية من نقاطه!`);
  parts.push(`وفي آخر ${opt.finalSeconds} ثانية، يبدأ الوقت الحاسم والنقاط كلها مضاعفة!`);
  parts.push(opt.goal > 0
    ? `أول فريق يوصل ${opt.goal} نقطة، أو يتصدر عند نهاية الوقت، هو الفائز!`
    : 'الفريق المتصدر عند نهاية الوقت هو الفائز!');
  parts.push('يلا! اختار فريقك الآن واكتب رقمه في التعليقات!');
  return parts.join(' ');
}

/** تذكير قصير بطريقة اللعب أثناء الجولة */
export function shortHowto(opt, random = Math.random) {
  const teams = opt.teams.map((t) => `${t.id} ${t.name}`).join('، ');
  return pick([
    `للي وصل جديد: اكتب رقم فريقك في التعليقات وشارك فوراً! ${teams}.`,
    `انضم للمعركة الآن! اكتب ${opt.teams.map((t) => t.id).join(' أو ')} في التعليقات، وكل لايك يعطي فريقك نقطة!`,
    `تذكير: كل عملة في الهدايا تساوي ${opt.giftPointsPerCoin} نقاط، و${opt.boostCoins} عملة تشغّل المضاعف!`,
  ], random);
}

/**
 * المعلّق: يستمع لأحداث اللعبة ويولّد جملاً حماسية للنطق بالصوت.
 * يرسل 'say' بالشكل {text, priority: 'high'|'normal'|'low', kind}.
 * يحدّ من تكرار الكلام حتى لا يغرق البث بالأصوات.
 */
export class Announcer extends EventEmitter {
  constructor(battle, opt = {}, { random = Math.random } = {}) {
    super();
    this.battle = battle;
    this.opt = { hypeEverySeconds: 22, howtoEverySeconds: 75, bigGiftCoins: 99, ...opt };
    this.random = random;
    this.lastSaidAt = 0;
    this.lastHypeAt = 0;
    this.lastHowtoAt = 0;
    this.lastLeadAt = 0;
    this.lastGiftAt = 0;
    this.pendingThanks = [];
    this.pendingJoins = [];
    this.pendingFollows = [];
    this.flushAt = 0;
    this.bind();
  }

  get now() { return this.battle.now(); }
  get g() { return this.battle.opt; }

  say(text, priority = 'normal', kind = 'line') {
    this.lastSaidAt = this.now;
    this.emit('say', { text, priority, kind, at: this.now });
  }

  howto() {
    this.lastHowtoAt = this.now;
    this.say(howtoText(this.g), 'high', 'howto');
  }

  bind() {
    const b = this.battle;
    b.on('phase', ({ phase }) => {
      if (phase === BPhase.LOBBY) {
        this.pendingJoins = [];
        // لا نعيد الشرح الكامل إذا قيل قبل قليل
        if (this.now - this.lastHowtoAt > 60_000) this.howto();
        else this.say('جولة جديدة قادمة! اختاروا فرقكم، والهدايا الآن تُحفظ لفريقكم لبداية الجولة!', 'normal', 'lobby');
      }
    });

    b.on('countdown', ({ seconds }) => {
      this.say(`المعركة تبدأ بعد ${seconds} ثانية! اكتبوا رقم فريقكم الآن!`, 'normal', 'countdown');
    });

    b.on('battleStart', ({ round }) => {
      this.lastHypeAt = this.now;
      this.say(pick([
        `انطلقت الجولة ${round}! يلا يا أبطال، علّقوا، اضغطوا لايك، وأرسلوا الهدايا لفريقكم!`,
        `الجولة ${round} بدأت! المعركة اشتعلت! كل لايك وكل تعليق يفرق!`,
        `بسم الله نبدأ الجولة ${round}! أروني مين الفريق الأقوى الليلة!`,
      ], this.random), 'high', 'start');
    });

    b.on('join', ({ user, team, auto, switched }) => {
      if (auto || switched) return;
      this.pendingJoins.push({ name: speakName(user.nickname), team: team.name });
    });

    b.on('gift', ({ user, team, gift, points, banked }) => {
      const name = speakName(user.nickname);
      const big = gift.coins >= this.opt.bigGiftCoins;
      if (big) {
        this.lastGiftAt = this.now;
        const vars = { name, team: team.name, gift: gift.name, points, count: gift.count };
        this.say(fill(pick([
          'واااو! شكراً {name} على {gift}! {points} نقطة لفريق {team}! أنت أسطورة!',
          'يا سلااام! {name} أرسل {gift}! فريق {team} يطير للأعلى بـ {points} نقطة!',
          'هدية ضخمة من {name}! شكراً من القلب! {team} تشتعل!',
        ], this.random), vars) + (banked ? ' النقاط محفوظة لبداية الجولة!' : ''), 'high', 'gift');
      } else {
        this.pendingThanks.push({ name, team: team.name, gift: gift.name, count: gift.count, points });
      }
    });

    b.on('follow', ({ user }) => this.pendingFollows.push(speakName(user.nickname)));
    b.on('share', ({ user, team, points }) => {
      if (this.random() < 0.5) this.say(`شكراً ${speakName(user.nickname)} على المشاركة! ${points} نقطة لفريق ${team.name}!`, 'low', 'share');
    });

    b.on('boost', ({ user, team, seconds, multiplier }) => {
      this.say(`المضاعف اشتغل! بفضل ${speakName(user.nickname)}، نقاط فريق ${team.name} مضروبة في ${multiplier} لمدة ${seconds} ثانية!`, 'high', 'boost');
    });

    b.on('bomb', ({ user, target, loss }) => {
      this.say(`بووووم! ${speakName(user.nickname)} فجّر قنبلة على فريق ${target.name}! خسروا ${loss} نقطة! هل سترد يا ${target.name}؟`, 'high', 'bomb');
    });

    b.on('leadChange', ({ team, prev }) => {
      if (!prev || this.now - this.lastLeadAt < 12_000) return;
      this.lastLeadAt = this.now;
      this.say(pick([
        `انقلاب! فريق ${team.name} ينتزع الصدارة!`,
        `فريق ${team.name} صار في المقدمة! مين يقدر يوقفهم؟`,
        `${team.name} في الصدارة الآن! يا جماعة الصراع مشتعل!`,
      ], this.random), 'normal', 'lead');
    });

    b.on('final', ({ seconds, multiplier }) => {
      this.say(`الوقت الحاسم! آخر ${seconds} ثانية، وكل النقاط مضروبة في ${multiplier}! أرسلوا كل ما عندكم الآن!`, 'high', 'final');
    });

    b.on('lastTen', () => {
      const leader = b.leader;
      this.say(leader
        ? `عشر ثواني فقط! فريق ${leader.name} متصدر! هل تلحقون عليه؟`
        : 'عشر ثواني فقط! النتيجة متعادلة! كل لايك يحسم المعركة!', 'high', 'countdown');
    });

    b.on('overtime', ({ seconds }) => {
      this.say(`تعادل نااار! وقت إضافي ${seconds} ثانية! الفريق اللي يتقدم أول يفوز!`, 'high', 'overtime');
    });

    b.on('winner', (result) => {
      if (!result) {
        this.say('انتهت الجولة بدون نقاط! الجولة الجاية لازم تكون أقوى، اختاروا فرقكم!', 'high', 'winner');
        return;
      }
      const mvp = result.mvp ? ` وبطل الجولة هو ${speakName(result.mvp.nickname)} بـ ${result.mvp.points} نقطة! صفقوا له!` : '';
      this.say(`مبرووووك لفريق ${result.team.name}! أبطال الجولة ${result.round}!${mvp} تابعونا عشان الجولة الجاية!`, 'high', 'winner');
    });

    b.on('tick', () => this.onTick());
  }

  onTick() {
    const now = this.now;
    // دمج الشكر الصغير في جملة واحدة كل بضع ثوانٍ
    if (now - this.flushAt >= 4000) {
      this.flushAt = now;
      this.flushThanks();
      this.flushFollows();
      this.flushJoins();
    }
    if (this.battle.phase !== BPhase.BATTLE) {
      if (this.battle.phase === BPhase.LOBBY && !this.battle.phaseEndsAt && now - this.lastHowtoAt > this.opt.howtoEverySeconds * 1000 * 1.5) {
        this.howto();
      }
      return;
    }
    if (now - this.lastSaidAt < 6000) return;
    if (now - this.lastHowtoAt >= this.opt.howtoEverySeconds * 1000) {
      this.lastHowtoAt = now;
      this.say(shortHowto(this.g, this.random), 'low', 'howto');
    } else if (now - this.lastHypeAt >= this.opt.hypeEverySeconds * 1000) {
      this.lastHypeAt = now;
      const line = this.hypeLine();
      if (line) this.say(line, 'low', 'hype');
    }
  }

  flushThanks() {
    const list = this.pendingThanks;
    if (!list.length) return;
    this.pendingThanks = [];
    if (list.length === 1) {
      const t = list[0];
      this.say(`شكراً ${t.name} على ${t.gift}! ${t.points} نقطة لفريق ${t.team}!`, 'normal', 'gift');
    } else {
      const names = [...new Set(list.map((t) => t.name))];
      const shown = names.slice(0, 3).join(' و ');
      const more = names.length > 3 ? ` و ${names.length - 3} أبطال كمان` : '';
      this.say(`شكراً ${shown}${more} على الهدايا! أنتم نار!`, 'normal', 'gift');
    }
  }

  flushFollows() {
    const names = [...new Set(this.pendingFollows)];
    if (!names.length) return;
    this.pendingFollows = [];
    const shown = names.slice(0, 3).join(' و ');
    const more = names.length > 3 ? ` و ${names.length - 3} متابعين جدد` : '';
    this.say(`شكراً على المتابعة ${shown}${more}! ${this.g.followPoints} نقطة لكل متابعة! تابعونا يا جماعة!`, 'low', 'follow');
  }

  flushJoins() {
    const list = this.pendingJoins;
    if (!list.length) return;
    this.pendingJoins = [];
    if (this.now - this.lastSaidAt < 2500 && list.length < 3) return;
    if (list.length === 1) {
      this.say(`أهلاً ${list[0].name}! انضممت لفريق ${list[0].team}!`, 'low', 'join');
    } else {
      this.say(`${list.length} أبطال جدد انضموا للمعركة! ${list.slice(0, 2).map((j) => j.name).join(' و ')} وغيرهم! وأنت، اكتب رقم فريقك!`, 'low', 'join');
    }
  }

  /** جملة حماسية مبنية على حالة المعركة الحالية */
  hypeLine() {
    const ranked = rankTeams(this.battle.teams);
    const [a, b] = ranked;
    const last = ranked[ranked.length - 1];
    const left = Math.ceil((this.battle.remainingMs || 0) / 1000);
    const options = [];
    if (a.points > 0 && b) {
      const gap = a.points - b.points;
      if (gap > 0) {
        options.push(`فريق ${a.name} متصدر بفارق ${gap} نقطة فقط عن ${b.name}! يا ${b.name}، وينكم؟`);
        options.push(`${a.name} في المقدمة! هدية وحدة ممكن تقلب كل شي!`);
      }
    }
    if (last && last !== a) options.push(`يا فريق ${last.name}! لا تستسلموا! اضغطوا لايك بقوة وارجعوا للمنافسة!`);
    options.push('اضغطوا على الشاشة بقوة! كل لايك نقطة لفريقك!');
    options.push('الحماس عالي! علّقوا باسم فريقكم وخلّونا نشوف مين الأقوى!');
    options.push(`تابع الحساب الآن وتحصل لفريقك على ${this.g.followPoints} نقطة فوراً!`);
    options.push(`شارك البث مع أصحابك واكسب ${this.g.sharePoints} نقطة لفريقك!`);
    if (left > 40) options.push(`باقي ${Math.floor(left / 60) ? `${Math.floor(left / 60)} دقيقة و ` : ''}${left % 60} ثانية! كل شي ممكن يتغير!`);
    return pick(options, this.random);
  }
}
