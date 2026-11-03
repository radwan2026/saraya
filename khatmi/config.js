import { fileURLToPath } from 'node:url';

// إعدادات تطبيق ختمي. يمكن تغيير معظمها من لوحة الإدارة (/admin.html) دون إعادة تشغيل.
export const config = {
  port: Number(process.env.PORT || 3000),
  dataDir: process.env.KHATMI_DATA_DIR || fileURLToPath(new URL('./data', import.meta.url)),
  // كلمة مرور لوحة الإدارة — غيّرها قبل التشغيل الفعلي!
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  // سر توقيع الجلسات — غيّره قبل التشغيل الفعلي!
  secret: process.env.KHATMI_SECRET || 'change-this-secret-in-production',
  // سر Webhook رسائل SMS (تطبيق إعادة توجيه الرسائل على هاتف استلام الرصيد)
  smsWebhookSecret: process.env.SMS_WEBHOOK_SECRET || '',
};

// القيم الافتراضية للإعدادات القابلة للتعديل من لوحة الإدارة (بالدينار الليبي)
export const defaultSettings = {
  pricePerLetter: 0.5, // سعر الحرف الواحد
  iconFee: 3, // رسوم الأيقونة المدمجة (نجمة، هلال، علامة صح)
  logoFee: 5, // رسوم الشعار الذي يرفعه العميل
  minPrice: 0, // حد أدنى لسعر الختم (0 = بدون حد)
  carriers: {
    madar: {
      name: 'المدار', nameEn: 'Almadar',
      number: process.env.MADAR_NUMBER || '0911110588', // رقم ختمي لاستقبال رصيد المدار
      rate: 1, // كل 1 د.ل رصيد مكالمات = 1 د.ل في المحفظة
      min: 5, max: 500, enabled: true,
    },
    libyana: {
      name: 'ليبيانا', nameEn: 'Libyana',
      number: process.env.LIBYANA_NUMBER || '', // ضع رقم ليبيانا (092/094) لاستقبال الرصيد
      rate: 1,
      min: 5, max: 500, enabled: Boolean(process.env.LIBYANA_NUMBER),
    },
  },
};
