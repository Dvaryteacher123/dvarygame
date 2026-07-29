import axios from 'axios';
import crypto from 'crypto';

const FIMIPAY_SECRET_KEY = process.env.FIMIPAY_SECRET_KEY;
const FIMIPAY_PUBLIC_ID = process.env.FIMIPAY_PUBLIC_ID;
const FIMIPAY_BASE_URL = process.env.FIMIPAY_BASE_URL || 'https://api.fimipay.com/v1';

if (!FIMIPAY_SECRET_KEY) {
  console.error('❌ FIMIPAY_SECRET_KEY is missing!');
}

export async function initiatePayment(paymentData) {
  try {
    const {
      phoneNumber,
      amount,
      network,
      reference,
      buyerEmail = 'customer@example.com',
      buyerName = 'Customer',
      test_outcome = null
    } = paymentData;

    // Clean phone number
    let cleanPhone = phoneNumber.replace(/\s/g, '');
    if (!cleanPhone.startsWith('255')) {
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '255' + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('255') && cleanPhone.length === 9) {
        cleanPhone = '255' + cleanPhone;
      }
    }

    const payload = {
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: cleanPhone,
      amount: amount,
      currency: 'TZS',
      order_id: reference,
      network: network,
      callback_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/webhook/fimipay`,
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet`
    };

    if (test_outcome && process.env.NODE_ENV !== 'production') {
      payload.test_outcome = test_outcome;
    }

    console.log('🚀 FimiPay Request:', {
      url: `${FIMIPAY_BASE_URL}/payments`,
      amount,
      phone: cleanPhone,
      network
    });

    const response = await axios.post(
      `${FIMIPAY_BASE_URL}/payments`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${FIMIPAY_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.status === 'success' || response.data.status === 'pending') {
      return {
        success: true,
        status: response.data.status || 'pending',
        order_id: response.data.data?.order_id || response.data.order_id || reference,
        payment_status: response.data.data?.payment_status || 'PENDING',
        transaction_id: response.data.data?.transaction_id || null,
        amount: response.data.data?.amount || amount,
        message: response.data.message || 'Payment initiated successfully',
        raw: response.data
      };
    } else {
      throw new Error(response.data.message || 'Payment initiation failed');
    }
  } catch (error) {
    console.error('❌ FimiPay Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid FimiPay API key. Please check your credentials.');
    } else if (error.response?.status === 400) {
      throw new Error(error.response.data?.message || 'Invalid payment request.');
    } else {
      throw new Error(error.response?.data?.message || error.message || 'Payment failed. Please try again.');
    }
  }
}

export function verifyWebhookSignature(payload, signature) {
  try {
    const webhookSecret = process.env.FIMIPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('⚠️ Webhook secret not set, skipping verification');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('❌ Webhook verification error:', error);
    return false;
  }
}

export function getSupportedNetworks() {
  return [
    { id: 'Vodacom', name: 'Vodacom', icon: '📱' },
    { id: 'Airtel', name: 'Airtel', icon: '📱' },
    { id: 'Tigo', name: 'Tigo', icon: '📱' },
    { id: 'Halotel', name: 'Halotel', icon: '📱' },
    { id: 'Yas', name: 'Yas', icon: '📱' }
  ];
}

export default {
  initiatePayment,
  verifyWebhookSignature,
  getSupportedNetworks
};
