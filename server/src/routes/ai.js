const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.post('/chat', async (req, res) => {
    const { student_id, message } = req.body;
    if (!student_id || !message) return res.status(400).json({ error: 'الطالب والرسالة مطلوبان' });
    try {
      const ctx = await getStudentContext(sql, student_id);
      if (!ctx) return res.status(404).json({ error: 'الطالب غير موجود' });
      const response = generateResponse(ctx, message);
      res.json({ response });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  async function getStudentContext(sql, studentId) {
    const s = await sql`SELECT s.name, c.name as circle_name, c.teacher_name FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.id = ${studentId}`;
    if (!s.length) return null;
    const behaviors = await sql`SELECT b.type, b.description, b.date, bt.name as bt_name FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = ${studentId} AND b.type = 'negative' ORDER BY b.date DESC`;
    const alerts = await sql`SELECT level_name, reason, status, action_taken FROM alerts WHERE student_id = ${studentId} ORDER BY created_at DESC`;
    const negByType = {}; behaviors.forEach(b => { const k = b.bt_name || b.description; negByType[k] = (negByType[k] || 0) + 1; });
    return { name: s[0].name, circle: s[0].circle_name, teacher: s[0].teacher_name, totalBehaviors: behaviors.length, negativeCount: behaviors.length, negativeByType: negByType, alerts, pendingAlerts: alerts.filter(a => a.status === 'pending').length };
  }

  function generateResponse(ctx, message) {
    const msg = message.toLowerCase();
    if (msg.includes('غياب') || msg.includes('حضور')) return attendanceAdvice(ctx);
    if (msg.includes('سلوك') || msg.includes('إساءة') || msg.includes('مشكل')) return conductAdvice(ctx);
    if (msg.includes('حفظ') || msg.includes('مراجعة') || msg.includes('مستوى') || msg.includes('تلاوة')) return academicAdvice(ctx);
    if (msg.includes('تواصل') || msg.includes('ولي') || msg.includes('أمر')) return parentAdvice(ctx);
    if (msg.includes('تحفيز') || msg.includes('تشجيع') || msg.includes('مكافأة')) return motivationAdvice(ctx);
    if (msg.includes('خطة') || msg.includes('علاج') || msg.includes('حل')) return planAdvice(ctx);
    if (msg.includes('تقييم') || msg.includes('ملخص') || msg.includes('حالة') || msg.includes('كيف') || msg.includes('وضع')) return overviewAdvice(ctx);
    if (msg.includes('إنذار') || msg.includes('تنبيه') || msg.includes('قرار')) return alertAdvice(ctx);
    return welcomeMessage(ctx);
  }

  function welcomeMessage(ctx) {
    return `مرحباً! أنا مساعدك التربوي للطالب ${ctx.name}.\n\nيمكنني مساعدتك في:\n📅 "حضور" — تحليل الحضور والغياب\n🚦 "سلوك" — تحليل السلوك\n📖 "حفظ" — المستوى الأكاديمي\n📞 "تواصل" — نصائح التواصل مع ولي الأمر\n⭐ "تحفيز" — طرق التشجيع\n📋 "خطة" — خطة تحسين\n🔔 "إنذارات" — حالة التنبيهات\n📊 "تقييم" — ملخص شامل\n\nأو اكتب سؤالك مباشرة! 🤲`;
  }

  function overviewAdvice(ctx) {
    let r = `📊 ملخص عن ${ctx.name}:\n📍 ${ctx.circle} — ${ctx.teacher}\n📈 إجمالي المخالفات: ${ctx.negativeCount}\n   🔔 تنبيهات: ${ctx.alerts.length} (${ctx.pendingAlerts} معلق)\n\n`;
    if (ctx.negativeCount === 0) {
      r += '🌟 ممتاز! لا توجد مخالفات مسجلة. حافظ على متابعة الطالب.';
    } else if (ctx.negativeCount <= 2) {
      r += '⚡ مخالفات قليلة. تابع باستمرار وحاول تجنب التصاعد.';
    } else {
      r += '⚠️ يحتاج اهتماماً خاصاً. اكتب "خطة" لخطة تحسين مفصلة.';
    }
    if (Object.keys(ctx.negativeByType).length > 0) { r += '\n\n📌 المخالفات الأكثر تكراراً:\n'; Object.entries(ctx.negativeByType).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => { r += `   • ${k}: ${v} مرة\n`; }); }
    return r;
  }

  function attendanceAdvice(ctx) {
    const u = ctx.negativeByType['غياب بدون عذر'] || 0, e = ctx.negativeByType['غياب بعذر'] || 0, t = ctx.negativeByType['تأخر عن الحلقة'] || 0;
    let r = `📊 حضور ${ctx.name}:\n• غياب بدون عذر: ${u}\n• غياب بعذر: ${e}\n• تأخر: ${t}\n\n`;
    if (u + e + t === 0) r += '✅ حضور ممتاز!';
    else if (u >= 3) r += '🚨 وضع حرج!\n1. اتصل بولي الأمر فوراً\n2. اسأل عن مشاكل أسرية/صحية\n3. وثّق كل محاولة تواصل';
    else if (u >= 1) r += '⚠️ يحتاج متابعة.\n1. تواصل مع ولي الأمر\n2. نبّه الطالب بلطف\n3. حفّزه بمكافأة الحضور';
    if (t >= 3) r += `\n\n⏰ ${t} تأخرات = ${Math.floor(t/3)} غياب حسب الميثاق`;
    return r;
  }

  function conductAdvice(ctx) {
    const m = ctx.negativeByType['الإساءة للمعلم أو الزملاء'] || 0, d = ctx.negativeByType['عدم الاستماع لتوجيهات المعلم'] || 0;
    let r = `📊 سلوك ${ctx.name}:\n`;
    if (m) r += `• إساءة: ${m}\n`; if (d) r += `• عدم استماع: ${d}\n`;
    if (m + d === 0) r += '✅ سلوك جيد!\n'; else r += `\n📋 التوصيات:\n1. جلسة فردية لفهم الأسباب\n2. إشراك الأسرة\n3. عقد سلوكي واضح\n4. مكافأة أي تحسن\n5. متابعة يومية`;
    if (m > 0) r += '\n\n⚠️ الإساءة = إنذار فوري حسب الميثاق';
    return r;
  }

  function academicAdvice(ctx) {
    const n = ctx.negativeByType['الإهمال المتكرر في الحفظ والمراجعة'] || 0;
    let r = `📊 مستوى ${ctx.name} الأكاديمي:\n• إهمال في الحفظ: ${n}\n\n`;
    if (n >= 3) r += '⚠️ يحتاج تدخل:\n1. تقليل كمية الحفظ مؤقتاً\n2. التركيز على المراجعة\n3. مكافأة كل إنجاز\n4. تنسيق مع الأسرة لـ 15 دقيقة مراجعة يومية';
    else if (n > 0) r += '⚡ يحتاج متابعة لتجنب تكرار الإهمال';
    else r += '✅ لا توجد ملاحظات على الجانب الأكاديمي';
    return r;
  }

  function parentAdvice(ctx) {
    let r = `📞 نصائح التواصل مع أسرة ${ctx.name}:\n\n1. 🕐 اختر الوقت المناسب\n2. 😊 ابدأ بالإيجابيات\n3. 🤝 كن شريكاً لا محاكماً\n4. 📝 كن محدداً بالتواريخ\n5. 💡 اقترح حلولاً\n6. 📱 وثّق كل تواصل\n7. 🔄 تابع بعد أسبوع`;
    if (ctx.pendingAlerts > 0) r += `\n\n⚠️ ${ctx.pendingAlerts} تنبيه معلق — تواصل قريباً`;
    return r;
  }

  function motivationAdvice(ctx) {
    let r = `⭐ تحفيز ${ctx.name}:\n\n1. 🏆 تكريم الملتزمين أسبوعياً\n2. ⭐ نظام نقاط/نجوم للسلوك المنضبط\n3. 📜 شهادات شهرية\n4. 🎯 أهداف شخصية بسيطة\n5. 👥 مسؤوليات داخل الحلقة\n6. 📞 اتصال إيجابي بولي الأمر عند التحسن\n7. 🤲 الدعاء أمام الجميع\n8. 📖 قصص حفاظ القرآن`;
    return r;
  }

  function planAdvice(ctx) {
    return `📋 خطة تحسين ${ctx.name}:\n\n🎯 الأسبوع 1:\n• جلسة فردية لفهم وضعه\n• اتصال بولي الأمر\n• أهداف بسيطة قابلة للقياس\n\n🎯 الأسبوع 2:\n• متابعة يومية\n• تعزيز أي تحسن\n• تقرير مرحلي\n\n🎯 الأسبوع 3-4:\n• تقييم التحسن\n• تعديل الخطة\n• تكريم إذا تحسن\n\n💡 ركّز على الإيجابيات أكثر من العقاب`;
  }

  function alertAdvice(ctx) {
    const p = ctx.alerts.filter(a => a.status === 'pending');
    let r = `🔔 تنبيهات ${ctx.name}:\n• إجمالي: ${ctx.alerts.length}\n• معلق: ${p.length}\n\n`;
    if (p.length > 0) { r += 'المعلقة:\n'; p.forEach((a,i) => { r += `${i+1}. ${a.level_name}: ${a.reason}\n`; }); r += '\n📋 عالج القرارات أولاً ثم الإنذارات ثم التنبيهات'; }
    else if (ctx.alerts.length > 0) r += '✅ تم التعامل مع الكل. أحسنت!';
    else r += '✅ لا توجد تنبيهات. وضع جيد.';
    return r;
  }

  return router;
};
