"use client";
import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface EventCardProps {
  id: string;
  title: string;
  address: string;
  image: string;
  startDate: string;
  ticketPrice: number;
  tags?: string[];
  isFeatured?: boolean;
  ticketTypes?: { price: number; quantity: number; sold: number }[];
}

export function EventCard({
  id,
  title,
  address,
  image,
  startDate,
  ticketPrice,
  tags = [],
  isFeatured,
  ticketTypes,
}: EventCardProps) {
  // Compute display price — use min of ticket_types if available
  const minPrice =
    ticketTypes && ticketTypes.length > 0
      ? Math.min(...ticketTypes.map((t) => t.price))
      : ticketPrice;

  const priceLabel =
    minPrice === 0 ? "Free" : `From ₦${minPrice.toLocaleString()}`;

  // Check if event is sold out
  const isSoldOut =
    ticketTypes &&
    ticketTypes.length > 0 &&
    ticketTypes.every((t) => (t.sold || 0) >= t.quantity);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      style={{ flexShrink: 0, width: 260 }}
    >
      <Link
        href={`/events/${id}`}
        style={{ textDecoration: "none", display: "block" }}
      >
        <div
          style={{
            width: 260,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            boxShadow: "0 4px 20px rgba(91,14,166,0.1)",
            border: "1px solid #EDE0F7",
          }}
        >
          {/* Image */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 160,
              backgroundColor: "#EDE0F7",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {image ? (
              <img
                src={image}
                alt={title}
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
                  background:
                    "linear-gradient(135deg, #5B0EA6, #3D0066)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Calendar
                  size={32}
                  style={{ color: "rgba(255,255,255,0.4)" }}
                />
              </div>
            )}

            {/* Gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, transparent 30%, rgba(61,0,102,0.85) 100%)",
              }}
            />

            {/* Badges */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                right: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              {isFeatured && (
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
              )}
              {isSoldOut && (
                <span
                  style={{
                    backgroundColor: "#EF4444",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 999,
                    marginLeft: "auto",
                  }}
                >
                  Sold Out
                </span>
              )}
            </div>

            {/* Title on image */}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 12,
                right: 12,
              }}
            >
              <p
                style={{
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: 14,
                  margin: 0,
                  lineHeight: 1.3,
                  fontFamily:
                    "var(--font-display, Syne, sans-serif)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {title}
              </p>
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: "10px 12px 12px" }}>

            {/* Date + price */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Calendar
                  size={11}
                  style={{ color: "#5B0EA6", flexShrink: 0 }}
                  strokeWidth={2}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "#5B0EA6",
                    fontWeight: 600,
                  }}
                >
                  {format(new Date(startDate), "dd MMM, yyyy")}
                </span>
              </div>

              {/* Price badge */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: isSoldOut ? "#9E9E9E" : "#5B0EA6",
                  fontFamily:
                    "var(--font-display, Syne, sans-serif)",
                  backgroundColor: isSoldOut ? "#F2EEF9" : "#EDE0F7",
                  padding: "2px 10px",
                  borderRadius: 999,
                }}
              >
                {isSoldOut ? "Sold Out" : priceLabel}
              </span>
            </div>

            {/* Address */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginBottom: tags && tags.length > 0 ? 8 : 0,
              }}
            >
              <MapPin
                size={10}
                style={{ color: "#9E9E9E", flexShrink: 0 }}
                strokeWidth={1.8}
              />
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
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  flexWrap: "nowrap",
                  overflow: "hidden",
                }}
              >
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