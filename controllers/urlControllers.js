const { nanoid } = require("nanoid");
const AppError = require("../util/appError");
const catchAsync = require("../util/catchAsync");
const { cusUrlSchema } = require("../util/validation");
const { db } = require("../db");
const { urlTable } = require("../models");
const { eq, sql } = require("drizzle-orm");

/**
 * SO the idea is to create
 *    1.post url
 *    2.get cus url
 *    3. u should get expiry date on the url
 *    4. others will see the expiry coundown
 *    5. afetr expired next fifo will get the url
 */

exports.postUrl = catchAsync(async (req, res, next) => {
  const { code, targetUrl, activeTime } = await cusUrlSchema.parseAsync(
    req.body,
  );

  if (!targetUrl) return next(new AppError("plz provide the url🏳🏳", 400));
  let shortCode = code || nanoid(6);
  //   if(!code){
  //      shortCode = nanoid(6)
  //   }

  //check the short code already exists in the db
  const existingCode = await db.query.urlTable.findFirst({
    where: eq(urlTable.code, shortCode),
  });

  // if exists then send res with shortcode suggestion with nanoid (code + nanoid)
  const expiry = new Date(Date.now() + activeTime * 24 * 60 * 60 * 1000);

  if (existingCode) {
    const msg = `Ur short code already exists😥.But u can actually use this ${shortCode}${nanoid(4)}. Or u can wait ${expiry}`;
    return next(new AppError(msg, 401));
  }
  //register shortcode and add expiry date

  const [url] = await db
    .insert(urlTable)
    .values({
      userId: req.user.id,
      code: shortCode,
      targetUrl: targetUrl,
      expiresAt: expiry,
    })
    .returning({
      id: urlTable.id,
      shortCode: urlTable.code,
      targetUrl: urlTable.targetUrl,
    });

  res.status(201).json({
    status: "success",
    data: {
      url,
    },
  });
});

exports.getUrl = catchAsync(async (req, res, next) => {
  const { shortCode } = req.params;

  const url = await db.query.urlTable.findFirst({
    where: eq(urlTable.code, shortCode),
  });

  if (!url) return next(new AppError("No url found", 404));
  //   console.log(url)

  const expiryDate = url.expiresAt;

  if (expiryDate && expiryDate < new Date()) {
    return next(new AppError("Url expired😪😪😪", 410));
  }

  await db
    .update(urlTable)
    .set({
      clickCount: sql`${urlTable.clickCount} + 1`,
    })
    .where(eq(urlTable.id, url.id));

  res.redirect(url.targetUrl);

  // if redirect successful then increment the click count
});
