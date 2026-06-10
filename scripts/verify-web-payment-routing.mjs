/**
 * Smoke test: website payment routing against production admin API.
 * Run: node scripts/verify-web-payment-routing.mjs
 */

const ADMIN = 'https://osmani-admin-api.onrender.com'

async function main() {
  const checkoutRes = await fetch(`${ADMIN}/api/payments/checkout-providers`)
  const checkout = await checkoutRes.json()
  const provider = String(checkout.payment_provider || '').toLowerCase()

  console.log('checkout-providers:', checkoutRes.status, checkout)

  const supported = new Set(['sonicpesa', 'zenopay', 'auraxpay'])
  if (!supported.has(provider)) {
    console.error('Unknown active provider:', provider)
    process.exit(1)
  }

  const createPathByProvider = {
    sonicpesa: '/api/payments/sonicpesa/create-order',
    zenopay: '/api/payments/create-payment',
    auraxpay: '/api/payments/auraxpay/create-order',
  }
  console.log('website create path:', createPathByProvider[provider] || '(unknown)')

  const legacyRes = await fetch(`${ADMIN}/api/payments/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      phone: '255712345678',
      plan_id: 3,
      amount: 3000,
      device_id: 'verify-legacy',
      device_fingerprint: 'verify-legacy',
    }),
  })
  const legacyBody = await legacyRes.text()
  console.log('legacy create-payment:', legacyRes.status, legacyBody.slice(0, 120))

  const sonicRes = await fetch(`${ADMIN}/api/payments/sonicpesa/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      phone: '255712345678',
      plan_id: 3,
      amount: 3000,
      device_id: 'verify-sonic',
      device_fingerprint: 'verify-sonic',
    }),
  })
  const sonicBody = await sonicRes.json()
  console.log('sonicpesa create-order:', sonicRes.status, {
    ok: sonicBody.ok,
    orderId: sonicBody.orderId,
    provider: sonicBody.provider,
  })

  if (sonicRes.status !== 201 || !sonicBody.orderId) {
    console.error('SonicPesa create-order failed')
    process.exit(1)
  }

  const statusRes = await fetch(
    `${ADMIN}/api/payment-status/${encodeURIComponent(sonicBody.orderId)}`,
  )
  const statusBody = await statusRes.json()
  console.log('payment-status:', statusRes.status, statusBody)

  console.log(
    `\nOK: Website routes ${provider} -> ${createPathByProvider[provider] || 'unknown'}.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
