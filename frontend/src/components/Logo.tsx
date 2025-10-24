import React from "react"
import lizardImg from "@/assets/images/lizard.png"

type Props = {
  alt?: string
  className?: string
  size?: "sm" | "md" | "lg"
  href?: string
}

const sizeMap: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-12 w-12",
}

export default function Logo({ alt = "Neuralizard", className = "", size = "md", href }: Props) {
  const classes = `${sizeMap[size]} ${className}`.trim()
  const img = <img src={lizardImg} alt={alt} className={classes} />
  return href ? (
    <a href={href} aria-label={alt} className="inline-flex items-center">
      {img}
    </a>
  ) : (
    img
  )
}
