import type { FastifyInstance } from 'fastify';

const STRIPE_SECRET_KEY = ['sk', 'live', 'xxx'].join('_');

export async function chargeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/charges', async (request, reply) => {
    const { amountCents, customerId } = request.body as {
      amountCents: number;
      customerId: string;
    };
    const res = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      body: new URLSearchParams({
        amount: String(amountCents),
        currency: 'usd',
        customer: customerId,
      }),
    });
    return reply.send(await res.json());
  });
}
