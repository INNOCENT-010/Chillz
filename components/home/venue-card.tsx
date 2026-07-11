"use client";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { motion } from "framer-motion";

interface VenueCardProps {
  id: string;
  name: string;
  category: string;
  address: string;
  image: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  size?: "sm" | "md";
  isFeatured?: boolean;
}

export function VenueCard({
  id, name, category, address, image,
  rating = 0, reviewCount = 0, tags = [],
  size = "md", isFeatured,
}: VenueCardProps) {
  const isSmall = size === "sm";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      style={{ width: isSmall ? "100%" : 240, flexShrink: 0 }}
    >
      <Link href={`/venue/${id}`} style={{ textDecoration: "none", display: "block" }}>
        <div
          style={{
            width: "100%",
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            boxShadow: "0 4px 20px rgba(91,14,166,0.08)",
            border: "1px solid #EDE0F7",
          }}
        >
          {/* Image */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: isSmall ? 140 : 160,
              backgroundColor: "#EDE0F7",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {image ? (
              <img
                src={image}
                alt={name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(135deg, #5B0EA6, #3D0066)",
                }}
              />
            )}

            {/* Gradient */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 40%, rgba(61,0,102,0.7) 100%)",
              }}
            />

            {/* Featured badge */}
            {isFeatured && (
              <div style={{ position: "absolute", top: 10, left: 10 }}>
                <span
                  style={{
                    backgroundColor: "#00C853",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 999,
                  }}
                >
                  Featured
                </span>
              </div>
            )}

            {/* Category badge */}
            <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
              <p
                style={{
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: isSmall ? 13 : 14,
                  margin: 0,
                  lineHeight: 1.3,
                  fontFamily: "var(--font-display, Syne, sans-serif)",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {name}
              </p>
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: "10px 12px 12px" }}>
            {/* Rating + category */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Star
                  size={12}
                  style={{ color: "#FBBF24", fill: "#FBBF24" }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>
                  {rating > 0 ? rating.toFixed(1) : "New"}
                </span>
                {reviewCount > 0 && (
                  <span style={{ fontSize: 11, color: "#9E9E9E" }}>
                    ({reviewCount})
                  </span>
                )}
              </div>
              <span
                style={{
                  backgroundColor: "#EDE0F7",
                  color: "#5B0EA6",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  textTransform: "capitalize",
                }}
              >
                {category?.replace(/-/g, " ")}
              </span>
            </div>

            {/* Address */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 7 }}>
              <MapPin size={10} style={{ color: "#9E9E9E", flexShrink: 0 }} strokeWidth={1.8} />
              <span
                style={{
                  fontSize: 11,
                  color: "#9E9E9E",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {address}
              </span>
            </div>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "nowrap", overflow: "hidden" }}>
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: "#F2EEF9",
                      color: "#5B0EA6",
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}