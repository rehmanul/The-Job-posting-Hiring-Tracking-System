import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  careerPageUrl: text("career_page_url"),
  isActive: boolean("is_active").default(true),
  lastScanned: timestamp("last_scanned"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobPostings = pgTable("job_postings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  company: text("company").notNull(),
  jobTitle: text("job_title").notNull(),
  location: text("location"),
  department: text("department"),
  postedDate: timestamp("posted_date"),
  foundDate: timestamp("found_date").defaultNow(),
  url: text("url"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  source: text("source").notNull(), // 'website', 'linkedin', 'careers_page'
  isNew: boolean("is_new").default(true),
  notificationSent: boolean("notification_sent").default(false),
});

export const newHires = pgTable("new_hires", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personName: text("person_name").notNull(),
  company: text("company").notNull(),
  position: text("position").notNull(),
  startDate: timestamp("start_date"),
  linkedinProfile: text("linkedin_profile"),
  source: text("source").notNull(), // 'linkedin_scrape', 'linkedin_announcement', 'company_announcement'
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  foundDate: timestamp("found_date").defaultNow(),
  isNew: boolean("is_new").default(true),
  notificationSent: boolean("notification_sent").default(false),
});

export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").defaultNow(),
  totalCompanies: integer("total_companies").default(0),
  activeCompanies: integer("active_companies").default(0),
  jobsFound: integer("jobs_found").default(0),
  hiresFound: integer("hires_found").default(0),
  successfulScans: integer("successful_scans").default(0),
  failedScans: integer("failed_scans").default(0),
  avgResponseTime: decimal("avg_response_time", { precision: 8, scale: 2 }),
  metadata: jsonb("metadata"),
});

export const healthMetrics = pgTable("health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow(),
  service: text("service").notNull(), // 'linkedin', 'google_sheets', 'slack', 'email', 'general'
  status: text("status").notNull(), // 'healthy', 'degraded', 'down'
  responseTime: decimal("response_time", { precision: 8, scale: 2 }),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
});

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow(),
  level: text("level").notNull(), // 'info', 'warn', 'error', 'debug'
  service: text("service").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
});

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  lastScanned: true,
});

export const insertJobPostingSchema = createInsertSchema(jobPostings).omit({
  id: true,
  foundDate: true,
  isNew: true,
  notificationSent: true,
});

export const insertNewHireSchema = createInsertSchema(newHires).omit({
  id: true,
  foundDate: true,
  isNew: true,
  notificationSent: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
  date: true,
});

export const insertHealthMetricSchema = createInsertSchema(healthMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type Company = typeof companies.$inferSelect;
export type JobPosting = typeof jobPostings.$inferSelect;
export type NewHire = typeof newHires.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type SystemLog = typeof systemLogs.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;
export type InsertNewHire = z.infer<typeof insertNewHireSchema>;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type InsertHealthMetric = z.infer<typeof insertHealthMetricSchema>;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
