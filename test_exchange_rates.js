import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aedzbijwbwklbbuwpzni.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIn0.zihSGWXv_Ki6naqmvIASkmtz-sYWMqvyXG7ZUzM68Fo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExchangeRateTable() {
  try {
    const { data: insertData, error: insertError } = await supabase
      .from('exchange_rates')
      .insert([{ currency: 'USD', rate: 85.0 }])
      .select();
      
    if (insertError) {
      console.error('Insert error details:', insertError);
    } else {
      console.log('Inserted rate successfully:', insertData);
    }

    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*');
    
    if (error) {
      console.error('Error fetching exchange_rates:', error);
    } else {
      console.log('Exchange rates:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkExchangeRateTable();
