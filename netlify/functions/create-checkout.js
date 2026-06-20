// Netlify Function: create-checkout.js
// Creates a Stripe Checkout Session server-side using the secret key
// stored in Netlify's environment variables (never exposed to the browser).


// Map internal product keys to their Stripe Price IDs.
// This mapping lives on the server so the browser never decides the price.
const PRICE_MAP = {
  core: 'price_1Tk3rjDH6WkYmLwWz77nk0L1',       // Core Numerology Reading - €97
  prognose: 'price_1Tk3uXDH6WkYmLwW8T1U5wAa',   // Personal Year Prognosis - €147
  bundle: 'price_1Tk3wdDH6WkYmLwW8bAtDyhA',     // Complete Bundle - €197
};

exports.handler = async (event) => {
  // TEMPORARY DEBUG LOG — remove after troubleshooting
  console.log('DEBUG: STRIPE_SECRET_KEY present?', !!process.env.STRIPE_SECRET_KEY);
  console.log('DEBUG: STRIPE_SECRET_KEY length:', (process.env.STRIPE_SECRET_KEY || '').length);
  console.log('DEBUG: STRIPE_SECRET_KEY prefix:', (process.env.STRIPE_SECRET_KEY || '').slice(0, 7));

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Initialize Stripe inside the handler so the debug logs above run first
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


  try {
    const body = JSON.parse(event.body || '{}');
    const { product, customerName, customerEmail, dob, question } = body;

    const priceId = PRICE_MAP[product];
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid product selected.' }),
      };
    }

    // Determine the site's base URL (works for any Netlify deploy URL or custom domain)
    const origin =
      event.headers.origin ||
      `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail || undefined,
      // Store the reading details as metadata so you can see them in the
      // Stripe Dashboard under the payment, and use them to prepare the reading.
      metadata: {
        customer_name: customerName || '',
        date_of_birth: dob || '',
        question: question || '',
        product: product || '',
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe Checkout error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Something went wrong creating your checkout session.' }),
    };
  }
};
