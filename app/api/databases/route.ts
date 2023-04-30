import { NextResponse } from 'next/server'
import { Reminder } from '@/components/ConfigureModal'
import { prisma } from '@/app/server/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { Client } from '@notionhq/client'
import { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getDatabasesByName, getNotionData } from '@/app/server/notion'

const formatReminder = (reminder: Reminder): { remindAt: number } => {
  switch (reminder.unit) {
    case 'min':
      return { remindAt: reminder.duration }
    case 'hour':
      return { remindAt: reminder.duration * 60 }
    case 'day':
      return { remindAt: reminder.duration * 3600 }
  }
}

const databaseApiFormSchema = z.object({
  event_name: z.string(),
  event_date: z.string(),
  event_description: z.string(),
  reminders: z
    .array(
      z.object({
        duration: z.number(),
        unit: z.union([z.literal('min'), z.literal('hour'), z.literal('day')]),
        id: z.string(),
      }),
    )
    .min(0),
  databaseId: z.string(),
  calendarId: z.string().optional(),
})

export async function GET(request: Request) {
  // @ts-ignore
  const session = await getServerSession(authOptions)

  if (!session?.user.id) {
    return NextResponse.json(
      { error: 'account non authenticated' },
      { status: 403 },
    )
  }

  const data = await getNotionData(session)
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const res = await request.json()
  const result = databaseApiFormSchema.safeParse(res)
  // @ts-ignore
  const session = await getServerSession(authOptions)

  if (!result.success) {
    console.log(result.error)
    return NextResponse.json({ error: 'missing params' }, { status: 422 })
  } else if (!session?.user.id) {
    return NextResponse.json(
      { error: 'account non authenticated' },
      { status: 403 },
    )
  } else {
    const reminders = result.data.reminders

    const cal = await prisma.calendar.upsert({
      where: {
        id: result.data?.calendarId ?? '-1',
      },
      create: {
        userId: session.user.id,
        databaseId: result.data.databaseId,
        title: result.data.event_name,
        dateField: result.data.event_date,
        description: result.data.event_description,
        calendarHash: '',
        calendarString: '',
        CalendarReminder: {
          create: reminders.map((r) => formatReminder(r)),
        },
      },
      update: {
        userId: session.user.id,
        databaseId: result.data.databaseId,
        title: result.data.event_name,
        dateField: result.data.event_date,
        description: result.data.event_description,
        calendarHash: '',
        calendarString: '',
        CalendarReminder: {
          deleteMany: {},
          createMany: {
            data: reminders.map((r) => formatReminder(r)),
          },
        },
      },
    })

    if (cal.id) {
      return NextResponse.json({ success: true }, { status: 201 })
    } else {
      return NextResponse.json({ success: false }, { status: 500 })
    }
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const calendarId = searchParams.get('calendarId')
  if (!!calendarId) {
    const res = await prisma.calendar.delete({
      where: {
        id: calendarId,
      },
    })

    if (res.id) {
      return NextResponse.json({ success: true }, { status: 200 })
    } else {
      return NextResponse.json({ success: false }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'missing params' }, { status: 422 })
  }
}