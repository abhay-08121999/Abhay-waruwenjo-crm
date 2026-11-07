import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:WaruWenJo%40%4026@db.aedzbijwbwklbbuwpzni.supabase.co:5432/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL database successfully!');

  try {
    // 1. Create table exchange_rates if it doesn't exist
    console.log('Creating exchange_rates table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.exchange_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        currency TEXT UNIQUE NOT NULL,
        rate NUMERIC NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Insert default rates
    console.log('Inserting default exchange rates...');
    await client.query(`
      INSERT INTO public.exchange_rates (currency, rate)
      VALUES 
        ('INR', 1.0),
        ('USD', 85.0),
        ('EUR', 92.0),
        ('AED', 23.0)
      ON CONFLICT (currency) DO UPDATE 
      SET rate = EXCLUDED.rate, updated_at = NOW();
    `);

    // 3. Ensure RLS is enabled and select policy exists
    console.log('Configuring Row Level Security (RLS) for exchange_rates...');
    await client.query(`
      ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
    `);

    // Drop policy if exists and recreate it to be sure
    await client.query(`
      DROP POLICY IF EXISTS "Allow public read access for exchange rates" ON public.exchange_rates;
      CREATE POLICY "Allow public read access for exchange rates" 
      ON public.exchange_rates FOR SELECT 
      USING (true);
    `);

    console.log('Verifying inserted rates...');
    const res = await client.query('SELECT * FROM public.exchange_rates;');
    console.log('Exchange Rates in DB:', res.rows);

  } catch (err) {
    console.error('Error during setup:', err);
  } finally {
    await client.end();
  }
}

main();
