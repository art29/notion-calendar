import Stripe from 'stripe'
import { getServerSession, Session } from 'next-auth'
import { prisma } from '@/app/server/db'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const key =
  process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_SECRET_KEY_LIVE ?? ''
    : process.env.STRIPE_SECRET_KEY_TEST ?? ''
export const stripe = new Stripe(key, {
  apiVersion: '2022-11-15',
  appInfo: {
    name: 'Notion Calendar',
    version: '1.0.0',
  },
})

export const findOrCreateStripeCustomer = async (
  session: Session,
): Promise<null | string> => {
  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  })

  if (!user || !user.email) {
    return null
  } else {
    if (!!user.stripeCustomerId) {
      return user.stripeCustomerId
    } else {
      const customerData = {
        ...(user.name && { name: user.name }),
        email: user.email,
        metadata: {
          uid: user.id,
        },
      }

      const stripeCustomer = await stripe.customers.create(customerData)

      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          stripeCustomerId: stripeCustomer.id,
        },
      })

      return updatedUser.stripeCustomerId
    }
  }
}

export const findStripeCustomer = async (
  userId: string,
): Promise<null | string> => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  })

  return user?.stripeCustomerId ?? null
}

const getUserActiveSubscriptions = async (
  userId?: string,
): Promise<null | Stripe.Subscription[]> => {
  // @ts-ignore
  const user = userId ?? (await getServerSession(authOptions))?.user?.id
  if (!user) {
    return null
  }

  const customer = await findStripeCustomer(user)
  if (!customer) {
    return null
  }

  const subs = await stripe.subscriptions.list({
    customer: customer,
  })

  return subs.data.filter(
    (d) => d.status === 'active' || d.status === 'trialing',
  )
}

export const isUserSubscribed = async (): Promise<{
  isSubscribed: boolean
  plans?: string[]
  fullPlanData?: Stripe.Subscription[]
}> => {
  const subs = await getUserActiveSubscriptions()

  if (!subs) {
    return {
      isSubscribed: false,
    }
  } else {
    return {
      isSubscribed: true,
      plans: subs.map((s) => s.id),
      fullPlanData: subs,
    }
  }
}

export const isUserPremium = async (
  userId?: string,
): Promise<{
  isPremium: boolean
  currentPlans?: string[]
}> => {
  const subs = await getUserActiveSubscriptions(userId)

  if (!subs) {
    return {
      isPremium: false,
      currentPlans: [],
    }
  }

  const validPremiumSubs = subs.filter(
    (d) =>
      d.items.data.filter(
        (p) =>
          p.price.id === process.env.NEXT_PUBLIC_MONTHLY_LINE_PRICE_PREMIUM ||
          p.price.id === process.env.NEXT_PUBLIC_YEARLY_LINE_PRICE_PREMIUM,
      ).length > 0,
  )

  return {
    isPremium: validPremiumSubs.length > 0,
    currentPlans: validPremiumSubs.map((p) => p.items.data[0].price.id),
  }
}
