CREATE TABLE "reset_passwords" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reset_passwords_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reset_passwords" ADD CONSTRAINT "reset_passwords_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;