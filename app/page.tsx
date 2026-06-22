"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { APP_NAME } from "@/lib/brand"

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to login page
    router.push("/app/login")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/20" />
        <p className="text-muted-foreground">Cargando {APP_NAME}...</p>
      </div>
    </div>
  )
}
