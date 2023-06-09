'use client'

import Button from '@/components/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faEdit,
  faLink,
  faLinkSlash,
  faStar,
  faTrash,
  faWrench,
} from '@fortawesome/free-solid-svg-icons'
import { EnhancedNotionDatabaseObject } from '@/app/dashboard/page'
import { useEffect, useState } from 'react'
import ConfigureModal from '@/components/ConfigureModal'
import { CopyToClipboard } from 'react-copy-to-clipboard'

interface NotionDatabaseTableProps {
  isPremium: boolean
}

const NotionDatabaseTable = ({ isPremium }: NotionDatabaseTableProps) => {
  const [selectedDatabase, setSelectedDatabase] =
    useState<EnhancedNotionDatabaseObject | null>(null)
  const [copiedCalendarUrl, setCopiedCalendarUrl] = useState<string | null>(
    null,
  )
  const [data, setData] = useState<null | EnhancedNotionDatabaseObject[]>(null)

  const getDatabase = async () => {
    fetch(`/api/databases`)
      .then(async (r) => r.json())
      .then((res) => {
        setData(res)
      })
      .catch((e) => console.error(e))
  }

  useEffect(() => {
    getDatabase()
  }, [])

  const deleteDatabase = (calendarId: string) => {
    fetch(`/api/databases?calendarId=${calendarId}`, {
      method: 'DELETE',
    }).then(async (r) => {
      if (r.status === 200) {
        await getDatabase()
      }
    })
  }

  const setAsPrimary = (calendarId?: string) => {
    if (calendarId) {
      fetch(`/api/databases`, {
        method: 'PUT',
        body: JSON.stringify({
          calendarId: calendarId,
        }),
      }).then(async (r) => {
        if (r.status === 200) {
          await getDatabase()
        }
      })
    }
  }

  const statusColor = (database: EnhancedNotionDatabaseObject) => {
    if (database.configured) {
      if (isPremium || database.calendar?.primary) {
        return 'bg-green-700'
      } else {
        return 'bg-orange-600'
      }
    } else {
      return 'bg-red-700'
    }
  }

  const isDisabled = (database: EnhancedNotionDatabaseObject) => {
    return !isPremium && !database.calendar?.primary
  }

  return data ? (
    <>
      <div className="my-3">
        <div className="relative overflow-x-auto shadow-sm rounded-lg">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs text-gray-700 uppercase bg-gray-300">
              <tr>
                <th scope="col" className="px-6 py-3">
                  Status
                </th>
                <th scope="col" className="px-6 py-3">
                  Database Name
                </th>
                <th scope="col" className="px-6 py-3">
                  Calendar URL
                </th>
                <th scope="col" className="px-6 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="bg-white border-b">
                  <th
                    scope="row"
                    className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"
                  >
                    <div
                      className={`rounded-full h-4 w-4 shadow-lg ${statusColor(
                        d,
                      )}`}
                    ></div>
                  </th>
                  <td className="px-6 py-4">{d.title[0].plain_text}</td>
                  <td className="px-6 py-4">
                    {d.configured && d.calendar && !isDisabled(d) ? (
                      <>
                        <CopyToClipboard
                          text={
                            `${process.env.NEXT_PUBLIC_ROOT_URL}/api/calendar/${d.calendar.id}.ics?hash=${d.calendar.calendarHash}` ??
                            ''
                          }
                          onCopy={() =>
                            setCopiedCalendarUrl(d.calendar?.id ?? '')
                          }
                        >
                          <Button theme="link" styling="px-0">
                            <>
                              Link
                              <FontAwesomeIcon className="pl-1" icon={faLink} />
                            </>
                          </Button>
                        </CopyToClipboard>
                        {copiedCalendarUrl === d.calendar.id && (
                          <span className="pl-1">
                            Copied <FontAwesomeIcon icon={faCheck} />
                          </span>
                        )}
                      </>
                    ) : (
                      <FontAwesomeIcon
                        className="pl-1 text-red-700 text-lg"
                        icon={faLinkSlash}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isDisabled(d) &&
                    data.some((d) => d.calendar?.primary) &&
                    d.configured ? (
                      <Button
                        onClick={() => setAsPrimary(d.calendar?.id)}
                        theme="link"
                        styling="px-0"
                      >
                        <div className="flex items-center">
                          Set as primary{' '}
                          <FontAwesomeIcon className="pl-1" icon={faStar} />
                        </div>
                      </Button>
                    ) : (
                      <div>
                        <Button
                          onClick={() => setSelectedDatabase(d)}
                          theme="link"
                          styling="px-0"
                        >
                          <div className="flex items-center">
                            {d.configured ? (
                              <>
                                <span>
                                  Edit
                                  <FontAwesomeIcon
                                    className="pl-1"
                                    icon={faEdit}
                                  />
                                </span>
                              </>
                            ) : (
                              <>
                                Configure
                                <FontAwesomeIcon
                                  className="pl-1"
                                  icon={faWrench}
                                />
                              </>
                            )}
                          </div>
                        </Button>
                        {d.configured && d && d.calendar?.id && (
                          <Button
                            onClick={() => deleteDatabase(d.calendar?.id ?? '')}
                            theme="link"
                            styling="pl-3 text-red-700"
                          >
                            <div className="flex items-center">
                              <span>
                                Delete
                                <FontAwesomeIcon
                                  className="pl-1 text-red-700"
                                  icon={faTrash}
                                />
                              </span>
                            </div>
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfigureModal
        database={selectedDatabase}
        refreshDatabases={getDatabase}
        closeModal={() => setSelectedDatabase(null)}
      />
    </>
  ) : (
    <div className="flex w-full justify-center py-6 my-2 bg-gray-300 rounded-lg">
      Loading Calendars...
      <div
        className="ml-3 animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-gray-800 rounded-full"
        role="status"
        aria-label="loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  )
}

export default NotionDatabaseTable
