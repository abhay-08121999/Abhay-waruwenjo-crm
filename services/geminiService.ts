/**
 * ⚠️ CRITICAL SECURITY WARNING ⚠️
 * 
 * This file contains a SERIOUS SECURITY VULNERABILITY that exposes your API key in client-side code.
 * 
 * PROBLEM:
 * - The Gemini API key is accessed via process.env.API_KEY in browser-executable code
 * - This means anyone can open browser DevTools, inspect the bundled JavaScript, and extract your API key
 * - Attackers can then use your API key for their own purposes, potentially costing you money
 * 
 * RECOMMENDED SOLUTION:
 * 1. Create a backend API server (Node.js/Express, Next.js API routes, Cloudflare Workers, etc.)
 * 2. Move all Gemini API calls to the backend
 * 3. Store the API key securely on the server (environment variables, secrets manager)
 * 4. Frontend makes requests to YOUR backend API endpoints
 * 5. Backend validates requests and makes calls to Gemini API
 * 
 * ARCHITECTURE EXAMPLE:
 * Frontend → Your Backend API → Gemini API
 * 
 * DO NOT USE THIS CODE IN PRODUCTION without implementing proper backend security.
 * This is suitable for development/demo purposes ONLY.
 */


import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from '../integrations/supabase/client';
import { MOCK_TEMPLATES } from '../constants.tsx';
import { Lead, VisaInvitation } from "../types.ts";

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key is missing. AI features will use offline fallback translation.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const TEMPLATE_MAPS: Record<string, Record<number, string>> = {
  Arabic: {
    1: `عزيزي {{recipient_name}}،\n\nيرجى الاطلاع على الرأي السريري المرفق من {{doctor_name}} بشأن الاستشارة الأخيرة لـ {{patient_name}}.\n\nملخص الرأي: {{opinion_text}}\n\nيرجى الاتصال بفريق التنسيق السريري لدينا إذا كان لديك أي أسئلة أخرى.\n\nمع التحيات،\nفريق WaruWenJo السريري`,
    2: `عزيزي {{recipient_name}}،\n\nمتابعة لمناقشتنا بخصوص {{equipment_name}}، يرجى العثور على الفاتورة الأولية المرفقة لمراجعتها.\n\nالقيمة الإجمالية المقدرة: {{value}}\nالصلاحية: 30 يومًا\n\nنتطلع إلى الشراكة مع {{facility_name}} في هذا التنفيذ.`,
    3: `عزيزي {{recipient_name}}،\n\nيسرنا إخطاركم بأن ممثلنا الإقليمي، {{rep_name}}، من المقرر أن يزور {{facility_name}} في {{visit_date}} الساعة {{visit_time}}.\n\nالغرض: {{purpose}}\n\nيرجى إعلامنا إذا كان هذا التوقيت يتطلب تعديلاً.`,
    4: `عزيزي {{recipient_name}}،\n\nتم إصدار خطاب دعوة التأشيرة الخاص بك (المرجع: {{vil_ref}}). يرجى الاطلاع على المستند الرسمي المرفق المرمز بـ QR لعملية طلب التأشيرة الخاصة بك.\n\nالمسافر: {{traveler_name}}\nجواز السفر: {{passport_number}}\n\nرحلة آمنة،\nعمليات WaruWenJo`
  },
  French: {
    1: `Cher {{recipient_name}},\n\nVeuillez trouver ci-joint l'avis clinique du {{doctor_name}} concernant la consultation récente pour {{patient_name}}.\n\nRésumé de l'avis: {{opinion_text}}\n\nVeuillez contacter notre équipe de coordination clinique si vous avez des questions complémentaires.\n\nCordialement,\nL'équipe clinique de WaruWenJo`,
    2: `Cher {{recipient_name}},\n\nSuite à notre discussion concernant le {{equipment_name}}, veuillez trouver ci-joint la facture proforma pour votre examen.\n\nValeur totale estimée: {{value}}\nValidité: 30 jours\n\nNous nous réjouissons de notre partenariat avec {{facility_name}} pour cette mise en œuvre.`,
    3: `Cher {{recipient_name}},\n\nNous vous informons par la présente que notre représentant régional, {{rep_name}}, doit visiter {{facility_name}} le {{visit_date}} à {{visit_time}}.\n\nObjectif: {{purpose}}\n\nVeuillez nous faire savoir si cet horaire doit être ajusté.`,
    4: `Cher {{recipient_name}},\n\nVotre lettre d'invitation de visa (Réf: {{vil_ref}}) a été émise. Veuillez trouver ci-joint le document officiel avec code QR pour votre demande de visa.\n\nVoyageur: {{traveler_name}}\nPasseport: {{passport_number}}\n\nBon voyage,\nOpérations WaruWenJo`
  },
  Spanish: {
    1: `Estimado {{recipient_name}},\n\nAdjunto encontrará la opinión clínica del {{doctor_name}} sobre la consulta reciente para {{patient_name}}.\n\nResumen de la opinión: {{opinion_text}}\n\nPor favor, póngase en contacto con nuestro equipo de coordinación clínica si tiene alguna pregunta de seguimiento.\n\nAtentamente,\nEl equipo clínico de WaruWenJo`,
    2: `Estimado {{recipient_name}},\n\nTras nuestra conversación sobre el {{equipment_name}}, adjunto encontrará la factura proforma para su revisión.\n\nValor total estimado: {{value}}\nValidez: 30 días\n\nEsperamos colaborar con {{facility_name}} en esta implementación.`,
    3: `Estimado {{recipient_name}},\n\nPor la presente le informamos que nuestro representante regional, {{rep_name}}, tiene previsto visitar {{facility_name}} el {{visit_date}} a las {{visit_time}}.\n\nMotivo: {{purpose}}\n\nPor favor, háganos saber si este horario requiere algún ajuste.`,
    4: `Estimado {{recipient_name}},\n\nSe ha emitido su carta de invitación de visa (Ref: {{vil_ref}}). Adjunto encontrará el documento oficial con código QR para su proceso de solicitud de visa.\n\nViajero: {{traveler_name}}\nPasaporte: {{passport_number}}\n\nBuen viaje,\nOperaciones de WaruWenJo`
  },
  Russian: {
    1: `Уважаемый(ая) {{recipient_name}},\n\nВ приложении находится клиническое заключение от врача {{doctor_name}} по результатам недавней консультации для {{patient_name}}.\n\nКраткое описание заключения: {{opinion_text}}\n\nПожалуйста, свяжитесь с нашей группой клинической координации, если у вас возникнут какие-либо дополнительные вопросы.\n\nС уважением,\nКлиническая команда WaruWenJo`,
    2: `Уважаемый(ая) {{recipient_name}},\n\nВ продолжение нашего обсуждения касательно {{equipment_name}}, в приложении находится проформа-инвойс для вашего рассмотрения.\n\nОбщая оценочная стоимость: {{value}}\nСрок действия: 30 дней\n\nМы будем рады сотрудничеству с {{facility_name}} по этому проекту.`,
    3: `Уважаемый(ая) {{recipient_name}},\n\nНастоящим сообщаем, что визит нашего регионального представителя {{rep_name}} в {{facility_name}} запланирован на {{visit_date}} в {{visit_time}}.\n\nЦель визита: {{purpose}}\n\nПожалуйста, сообщите нам, если это время требует корректировки.`,
    4: `Уважаемый(ая) {{recipient_name}},\n\nВаше визовое приглашение (Ref: {{vil_ref}}) было успешно выпущено. В приложении находится официальный документ с QR-кодом для подачи на визу.\n\nПутешественник: {{traveler_name}}\nПаспорт: {{passport_number}}\n\nСчастливого пути,\nОтдел операций WaruWenJo`
  },
  Portuguese: {
    1: `Prezado(a) {{recipient_name}},\n\nEm anexo, encontra-se o parecer clínico do(a) Dr(a). {{doctor_name}} referente à consulta recente de {{patient_name}}.\n\nResumo do parecer: {{opinion_text}}\n\nEntre em contato com nossa equipe de coordenação clínica se tiver alguma dúvida adicional.\n\nAtenciosamente,\nEquipe Clínica WaruWenJo`,
    2: `Prezado(a) {{recipient_name}},\n\nApós a nossa conversa sobre o {{equipment_name}}, segue em anexo a fatura proforma para sua análise.\n\nValor total estimado: {{value}}\nValidade: 30 dias\n\nEsperamos colaborar com a {{facility_name}} nesta implementação.`,
    3: `Prezado(a) {{recipient_name}},\n\nInformamos que o nosso representante regional, {{rep_name}}, tem uma visita agendada à {{facility_name}} em {{visit_date}} às {{visit_time}}.\n\nObjetivo: {{purpose}}\n\nPor favor, avise-nos caso este horário necessite de ajuste.`,
    4: `Prezado(a) {{recipient_name}},\n\nA sua Carta de Convite de Visto (Ref: {{vil_ref}}) foi emitida. Segue em anexo o documento oficial com código QR para o seu processo de pedido de visto.\n\nViajante: {{traveler_name}}\nPassaporte: {{passport_number}}\n\nBoa viagem,\nOperações WaruWenJo`
  },
  German: {
    1: `Sehr geehrte(r) {{recipient_name}},\n\nim Anhang finden Sie die klinische Stellungnahme von {{doctor_name}} bezüglich der jüngsten Konsultation für {{patient_name}}.\n\nZusammenfassung der Stellungnahme: {{opinion_text}}\n\nBitte kontaktieren Sie unser klinisches Koordinationsteam, wenn Sie weitere Fragen haben.\n\nMit freundlichen Grüßen,\nKlinisches Team von WaruWenJo`,
    2: `Sehr geehrte(r) {{recipient_name}},\n\nim Anschluss an unsere Besprechung bezüglich des {{equipment_name}} finden Sie im Anhang die Proforma-Rechnung zu Ihrer Prüfung.\n\nGeschätzter Gesamtwert: {{value}}\nGültigkeit: 30 Tage\n\nWir freuen uns auf die Zusammenarbeit mit {{facility_name}} bei dieser Implementierung.`,
    3: `Sehr geehrte(r) {{recipient_name}},\n\nhiermit teilen wir Ihnen mit, dass unser regionaler Vertreter, {{rep_name}}, am {{visit_date}} um {{visit_time}} einen Besuch bei {{facility_name}} plant.\n\nZweck: {{purpose}}\n\nBitte lassen Sie uns wissen, ob dieser Termin angepasst werden muss.`,
    4: `Sehr geehrte(r) {{recipient_name}},\n\nIhr Einladungsschreiben (Ref: {{vil_ref}}) wurde ausgestellt. Im Anhang finden Sie das offizielle Dokument mit QR-Code für Ihren Visumantrag.\n\nReisender: {{traveler_name}}\nReisepass: {{passport_number}}\n\nGute Reise,\nWaruWenJo Operations`
  },
  Chinese: {
    1: `尊敬的 {{recipient_name}}：\n\n随信附上 {{doctor_name}} 医生关于 {{patient_name}} 最近咨询的临床意见。\n\n意见摘要：{{opinion_text}}\n\n如果您有任何后续问题，请联系我们的临床协调团队。\n\n此致，\nWaruWenJo 临床团队`,
    2: `尊敬的 {{recipient_name}}：\n\n关于 {{equipment_name}} 的讨论，随信附上形式发票供您审阅。\n\n预估总价值：{{value}}\n有效期：30天\n\n我们期待在本次项目中与 {{facility_name}} 合作。`,
    3: `尊敬的 {{recipient_name}}：\n\n特此通知，我们的区域代表 {{rep_name}} 计划于 {{visit_date}} {{visit_time}} 拜访 {{facility_name}}。\n\n目的：{{purpose}}\n\n如果此时间需要调整，请告知我们。`,
    4: `尊敬的 {{recipient_name}}：\n\n您的签证邀请函（参考：{{vil_ref}}）已签发。随信附上带二维码的官方文件，供您申请签证使用。\n\n旅客：{{traveler_name}}\n护照号：{{passport_number}}\n\n祝您旅途愉快，\nWaruWenJo 运营部`
  },
  Hindi: {
    1: `प्रिय {{recipient_name}},\n\nकृपया {{patient_name}} के हालिया परामर्श के संबंध में {{doctor_name}} से प्राप्त नैदानिक ​​राय संलग्न पाएं।\n\nराय का सारांश: {{opinion_text}}\n\nयदि आपके कोई अनुवर्ती प्रश्न हैं तो कृपया हमारी नैदानिक ​​समन्वय टीम से संपर्क करें।\n\nसादर,\nWaruWenJo क्लिनिकल टीम`,
    2: `प्रिय {{recipient_name}},\n\n{{equipment_name}} के संबंध में हमारी चर्चा के बाद, कृपया समीक्षा के लिए संलग्न प्रोफार्मा चालान प्राप्त करें।\n\nकुल अनुमानित मूल्य: {{value}}\nवैधता: 30 दिन\n\nहम इस कार्यान्वयन पर {{facility_name}} के साथ साझेदारी करने के लिए तत्पर हैं।`,
    3: `प्रिय {{recipient_name}},\n\nयह सूचित करने के लिए है कि हमारे क्षेत्रीय प्रतिनिधि, {{rep_name}}, {{visit_date}} को {{visit_time}} बजे {{facility_name}} का दौरा करने के लिए निर्धारित हैं।\n\nउद्देश्य: {{purpose}}\n\nकृपया हमें बताएं कि क्या इस समय में समायोजन की आवश्यकता है।`,
    4: `प्रिय {{recipient_name}},\n\nआपका वीज़ा आमंत्रण पत्र (संदर्भ: {{vil_ref}}) जारी कर दिया गया है। वीज़ा आवेदन प्रक्रिया के लिए कृपया संलग्न क्यूआर-सक्षम आधिकारिक दस्तावेज़ ढूंढें।\n\nयात्री: {{traveler_name}}\nपासपोर्ट: {{passport_number}}\n\nशुभ यात्रा,\nWaruWenJo ऑपरेशन्स`
  },
  Japanese: {
    1: `{{recipient_name}} 様\n\n{{patient_name}} 様の最近の診察に関する {{doctor_name}} 医師からの臨床所見を添付いたします。\n\n所見サマリー：{{opinion_text}}\n\nご不明な点がございましたら、当院の臨床コーディネーションチームまでお問い合わせください。\n\n敬具、\nWaruWenJo 臨床チーム`,
    2: `{{recipient_name}} 様\n\n{{equipment_name}} に関するお打ち合わせに基づき、お見積書（プロフォーマインボイス）を添付いたします。\n\n推定総額：{{value}}\n有効期限：30日間\n\n{{facility_name}} 様とのプロジェクト開始を心より楽しみにしております。`,
    3: `{{recipient_name}} 様\n\n弊社の地域担当者 {{rep_name}} が {{visit_date}} {{visit_time}} に {{facility_name}} 様を訪問する予定ですのでお知らせいたします。\n\n目的：{{purpose}}\n\n調整が必要な場合はお知らせください。`,
    4: `{{recipient_name}} 様\n\nビザ招待状（参照：{{vil_ref}}）が発行されました。ビザ申請手続きのため、添付のQRコード付き公式書類をご確認ください。\n\n渡航者：{{traveler_name}}\nパスポート：{{passport_number}}\n\n道中お気をつけて、\nWaruWenJo 運営担当`
  },
  Bengali: {
    1: `প্রিয় {{recipient_name}},\n\nঅনুগ্রহ করে {{patient_name}} এর সাম্প্রতিক পরামর্শ সংক্রান্ত {{doctor_name}} এর কাছ থেকে প্রাপ্ত ক্লিনিকাল মতামতটি সংযুক্ত খুঁজুন।\n\nমতামতের সারাংশ: {{opinion_text}}\n\nআপনার যদি কোনো ফলো-আপ প্রশ্ন থাকে তাহলে অনুগ্রহ করে আমাদের ক্লিনিকাল সমন্বয় দলের সাথে যোগাযোগ করুন।\n\nবিনীত,\nWaruWenJo ক্লিনিকাল দল`,
    2: `প্রিয় {{recipient_name}},\n\n{{equipment_name}} নিয়ে আমাদের আলোচনার পর, আপনার পর্যালোচনার জন্য সংযুক্ত প্রফর্মা চালানটি খুঁজুন.\n\nমোট আনুমানিক মূল্য: {{value}}\nমেয়াদ: 30 দিন\n\nআমরা এই বাস্তবায়নে {{facility_name}} এর সাথে অংশীদারিত্বের জন্য উন্মুখ।`,
    3: `প্ৰিয় {{recipient_name}},\n\nআপনাকে জানানোর জন্য যে আমাদের আঞ্চলিক প্রতিনিধি, {{rep_name}}, {{visit_date}} তারিখে {{visit_time}} টায় {{facility_name}} পরিদর্শনের জন্য নির্ধারিত হয়েছে।\n\nউদ্দেশ্য: {{purpose}}\n\nঅনুরোধ আমাদের জানান যদি এই সময় পরিবর্তন করার প্রয়োজন হয়।`,
    4: `প্ৰিয় {{recipient_name}},\n\nআপনার ভিসা আমন্ত্রণ পত্র (রেফারেন্স: {{vil_ref}}) জারি করা হয়েছে। ভিসা আবেদন প্রক্রিয়ার জন্য সংযুক্ত কিউআর-কোড যুক্ত অফিশিয়াল নথিটি দেখুন।\n\nযাত্রী: {{traveler_name}}\nপাসপোর্ট: {{passport_number}}\n\nনিরাপদ ভ্রমণ,\nWaruWenJo অপারেশনস`
  }
};

const detectTemplate = (text: string): number => {
  const lower = text.toLowerCase();

  if (
    lower.includes('opinion') ||
    lower.includes('clinical') ||
    lower.includes('parecer') ||
    lower.includes('stellungnahme') ||
    lower.includes('意見') ||
    lower.includes('मंतव्य') ||
    lower.includes('পরামর্শ') ||
    lower.includes('رأي')
  ) {
    return 1;
  }
  if (
    lower.includes('proforma') || 
    lower.includes('invoice') ||
    lower.includes('فاتورة') || 
    lower.includes('التقديرية') || 
    lower.includes('facture') || 
    lower.includes('factura') || 
    lower.includes('инвойс') || 
    lower.includes('見積') ||
    lower.includes('चालान')
  ) {
    return 2;
  }
  
  if (
    lower.includes('representative') || 
    lower.includes('visit') || 
    lower.includes('ممثلنا') || 
    lower.includes('زيارة') || 
    lower.includes('représentant') || 
    lower.includes('representante') || 
    lower.includes('представитель') || 
    lower.includes('vertreter') || 
    lower.includes('प्रतिनिधि') || 
    lower.includes('পরিদর্শন') || 
    lower.includes('訪問')
  ) {
    return 3;
  }
  
  if (
    lower.includes('visa') || 
    lower.includes('تأشيرة') || 
    lower.includes('invitation') || 
    lower.includes('دعوة') || 
    lower.includes('invitación') || 
    lower.includes('приглашение') || 
    lower.includes('convite') || 
    lower.includes('einladung') || 
    lower.includes('वीज़ा') || 
    lower.includes('ভিসা') || 
    lower.includes('査証')
  ) {
    return 4;
  }
  
  return 0;
};

const fallbackTranslate = (text: string, targetLanguage: string): string => {
  let cleanText = text;
  while (true) {
    const replaced = cleanText.replace(/^\[(?:Translated to|ترجمة|Traduction|Traducción|Translated)[^\]]*\]\s*/gi, '');
    if (replaced === cleanText) break;
    cleanText = replaced;
  }
  cleanText = cleanText.trim();

  const templateId = detectTemplate(cleanText);
  
  if (templateId > 0 && TEMPLATE_MAPS[targetLanguage] && TEMPLATE_MAPS[targetLanguage][templateId]) {
    return TEMPLATE_MAPS[targetLanguage][templateId];
  }

  return `[Translated to ${targetLanguage}] ` + cleanText;
};

export const translateMedicalContent = async (text: string, targetLanguage: string) => {
  // If target is English, just return the original text
  if (targetLanguage === 'English') {
    return text;
  }

  // Prefer calling a server-side Supabase Edge function that holds the OpenRouter API key.
  try {
    const { data, error } = await supabase.functions.invoke('translate-openrouter', {
      body: { text, targetLanguage }
    });

    if (error) {
      console.warn('translate-openrouter function error, falling back to client-side translation:', error.message || error);
      return fallbackTranslate(text, targetLanguage);
    }

    if (data?.translatedText) return data.translatedText;

    console.warn('translate-openrouter returned no translatedText, falling back');
    return fallbackTranslate(text, targetLanguage);
  } catch (fnErr) {
    console.warn('translate-openrouter invoke failed (falling back):', fnErr);
    return fallbackTranslate(text, targetLanguage);
  }
};
export const generateVisaInvitationContent = async (data: any) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Generate a formal Visa Invitation Letter for medical business travel.
      Traveler: ${data.travelerName}
      Passport: ${data.passportNumber}
      Nationality: ${data.nationality}
      Purpose: ${data.purpose}
      Dates: ${data.startDate} to ${data.endDate}
      Target Embassy: ${data.embassyName || 'General Consular Section'}
      
      The letter should be from "WaruWenJo Operations" and addressed "To the Consular Officer at ${data.embassyName || 'the Embassy'}". 
      Include details about the medical facility they are visiting and mention that the traveler's expenses are covered by the host organization. 
      The tone must be diplomatic and strictly professional. If a specific embassy was provided, reference the city in the letterhead context.`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini VIL Error:", error);
    return null;
  }
};

export const generateSpecializedOpinion = async (packageName: string, patientName: string, queryContext: string) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Generate a highly detailed, professional medical opinion for a "${packageName}" package.
      Patient: ${patientName}
      Initial Query/Condition: ${queryContext}

      Structure the output with:
      1. Clinical Overview (Explain the procedure simply but professionally)
      2. Comprehensive Eligibility Criteria (What is required for this package)
      3. Procedural Methodology (Detailed surgical/treatment stages)
      4. Recovery & Post-Op Stay (Estimated Hospital stay, Intensive Care, and Rehab)
      5. Risk-Benefit Analysis (Success indicators vs. potential complications)
      6. Pre-Travel Preparation (Specific steps the patient must take before arriving)
      
      The tone must be clinical, reassuring, and highly structured for official document presentation. Use clear Markdown headers. Avoid boilerplate disclaimers about not being a doctor; assume the role of a Clinical Triage Director.`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Specialized Opinion Error:", error);
    return null;
  }
};

export const generateLeadInsights = async (lead: Lead) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Analyze this Medical CRM lead and provide a summary focusing on healthcare industry procurement cycles, HIPAA/ISO compliance needs, and medical decision-maker priorities.
      Lead Info:
      Name: ${lead.name}
      Facility: ${lead.company}
      Current Status: ${lead.status}
      Est. Contract Value: ${lead.value}
      Context: ${lead.notes}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAction: { type: Type.STRING },
            followUpTemplate: { type: Type.STRING }
          },
          required: ["summary", "opportunities", "risks", "suggestedAction", "followUpTemplate"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return null;
  }
};

export const generatePipelineSummary = async (leads: Lead[]) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return "AI analysis disabled: Missing API Key";

    const totalValue = leads.reduce((sum, l) => sum + l.value, 0);
    const leadData = leads.map(l => ({ name: l.name, status: l.status, value: l.value }));

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `You are a Medical Sales Director. Here is the current regional pipeline data:
      Total Portfolio: ${totalValue}
      Leads: ${JSON.stringify(leadData)}
      
      Provide a strategic health tech market analysis for your sales team. Focus on hospital trends and clinic outreach optimizations.`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "AI analysis failed. Please check network connection.";
  }
};

export const generateCallSummary = async (data: {
  patientName: string;
  treatmentInterest: string;
  outcome: string;
  rawNotes: string;
}): Promise<string> => {
  const ai = getGeminiClient();
  if (!ai) {
    return `Patient: ${data.patientName}\nOutcome: ${data.outcome || 'Not recorded'}\nInterest: ${data.treatmentInterest || 'Not specified'}\nNotes: ${data.rawNotes}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a concise, editable CRM call summary for a medical tourism enquiry. Use these headings: Patient Interest, Call Outcome, Key Concerns, Next Steps. Do not invent facts.\n\nPatient: ${data.patientName}\nTreatment interest: ${data.treatmentInterest}\nCall outcome: ${data.outcome}\nRaw notes: ${data.rawNotes}`,
    config: { temperature: 0.2 },
  });
  return response.text?.trim() || data.rawNotes;
};
