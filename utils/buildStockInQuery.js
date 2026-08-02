const Product = require("../models/Product");


async function buildStockInQuery(queryParams) {
    const { sku, productName, variantName, startDate, endDate } = queryParams;

    const query = {};

    // ---------------- Product Filters ----------------
    if (sku || productName || variantName) {

        const productFilter = {};

        if (sku) {
            productFilter.sku = { $regex: `^${sku}$`, $options: "i" };
        }

        if (productName) {
            productFilter.name = { $regex: productName, $options: "i" };
        }

        if (variantName) {
            productFilter.variantName = {
                $regex: variantName,
                $options: "i"
            };
        }

        const products = await Product.find(productFilter).select("_id");

        if (!products.length) {
            return {
                error: true,
                status: 404,
                message: "No matching product found."
            };
        }

        query.product = {
            $in: products.map(product => product._id)
        };
    }

    // ---------------- Date Filters ----------------
    if (startDate && endDate) {

        if (
            isNaN(Date.parse(startDate)) ||
            isNaN(Date.parse(endDate))
        ) {
            return {
                error: true,
                status: 400,
                message: "Invalid date format."
            };
        }

        if (new Date(startDate) > new Date(endDate)) {
            return {
                error: true,
                status: 400,
                message: "Start date cannot be after end date."
            };
        }

        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };

    } else if (!startDate && !endDate) {

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        query.createdAt = {
            $gte: thirtyDaysAgo
        };

    } else {

        return {
            error: true,
            status: 400,
            message: "Both startDate and endDate must be provided."
        };

    }

    return {
        success: true,
        query
    };
}

module.exports = buildStockInQuery;