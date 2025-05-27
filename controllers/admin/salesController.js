const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema');
const moment = require('moment');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const loadSalesReport = async (req, res) => {
  try {
    const filterType = req.query.filter || 'monthly';
    let startDate, endDate;

    const now = moment();
    switch (filterType) {
      case 'daily':
        startDate = now.startOf('day').toDate();
        endDate = now.endOf('day').toDate();
        break;
      case 'weekly':
        startDate = now.startOf('week').toDate();
        endDate = now.endOf('week').toDate();
        break;
      case 'monthly':
        startDate = now.startOf('month').toDate();
        endDate = now.endOf('month').toDate();
        break;
      case 'yearly':
        startDate = now.startOf('year').toDate();
        endDate = now.endOf('year').toDate();
        break;
      case 'custom':
        if (!req.query.startDate || !req.query.endDate) {
          return res.status(400).render('sales', {
            pageTitle: 'Sales Management',
            orders: [],
            totalOrders: 0,
            grossSales: 0,
            netSales: 0,
            couponsRedeemed: 0,
            couponDiscounts: 0,
            offerDiscounts: 0,
            returnsAndCancellations: 0,
            filter: {
              type: 'monthly',
              startDate: moment().startOf('month').format('YYYY-MM-DD'),
              endDate: moment().endOf('month').format('YYYY-MM-DD'),
            },
            pagination: { currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false },
            activePage: 'sales',
            error: 'Start and end dates are required for custom filter',
          });
        }
        startDate = moment(req.query.startDate).startOf('day').toDate();
        endDate = moment(req.query.endDate).endOf('day').toDate();
        if (startDate > endDate) {
          return res.status(400).render('sales', {
            pageTitle: 'Sales Management',
            orders: [],
            totalOrders: 0,
            grossSales: 0,
            netSales: 0,
            couponsRedeemed: 0,
            couponDiscounts: 0,
            offerDiscounts: 0,
            returnsAndCancellations: 0,
            filter: {
              type: 'monthly',
              startDate: moment().startOf('month').format('YYYY-MM-DD'),
              endDate: moment().endOf('month').format('YYYY-MM-DD'),
            },
            pagination: { currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false },
            activePage: 'sales',
            error: 'Start date cannot be after end date',
          });
        }
        break;
      default:
        startDate = now.startOf('month').toDate();
        endDate = now.endOf('month').toDate();
    }

    const filter = {
      status: 'Delivered',
      createdOn: { $gte: startDate, $lte: endDate },
    };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalDeliveredOrdersCount = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'orderedItems.product',
        select: 'name brand images regularPrice salePrice',
      })
      .lean();

    const allOrders = await Order.find(filter).lean();

    const processedOrders = orders.map((order) => {
      order.customerName =
        order.address?.name ||
        'Customer #' + (order.orderId || order._id.toString().slice(-4));
      order.customerInitials =
        (order.address?.name
          ? order.address.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : 'C' + (order.orderId?.slice(-1) || order._id.toString().slice(-1))) || 'CU';
      order.customerEmail = order.address?.email || '';
      order.orderedItems = order.orderedItems?.filter((item) => item.product) || [];
      return order;
    });

    const totalSales = allOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const couponsRedeemed = allOrders.filter((order) => order.coupenApplied).length;
    const couponDiscounts = allOrders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
    const offerDiscounts = allOrders.reduce((sum, order) => sum + (order.offerDiscount || 0), 0);
    const returnsAndCancellations = await Order.countDocuments({
      status: { $in: ['Cancelled', 'Returned'] },
      createdOn: { $gte: startDate, $lte: endDate },
    });

    res.render('sales', {
      pageTitle: 'Sales Management',
      orders: processedOrders,
      totalOrders: totalDeliveredOrdersCount,
      grossSales: totalSales,
      netSales: totalSales - couponDiscounts - offerDiscounts,
      couponsRedeemed,
      couponDiscounts,
      offerDiscounts,
      returnsAndCancellations,
      filter: {
        type: filterType,
        startDate: moment(startDate).format('YYYY-MM-DD'),
        endDate: moment(endDate).format('YYYY-MM-DD'),
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDeliveredOrdersCount / limit),
        hasNext: page < Math.ceil(totalDeliveredOrdersCount / limit),
        hasPrev: page > 1,
      },
      activePage: 'sales',
    });
  } catch (error) {
    console.error('Error loading sales report:', error);
    res.status(500).render('sales', {
      pageTitle: 'Sales Management',
      orders: [],
      totalOrders: 0,
      grossSales: 0,
      netSales: 0,
      couponsRedeemed: 0,
      couponDiscounts: 0,
      offerDiscounts: 0,
      returnsAndCancellations: 0,
      filter: {
        type: 'monthly',
        startDate: moment().startOf('month').format('YYYY-MM-DD'),
        endDate: moment().endOf('month').format('YYYY-MM-DD'),
      },
      pagination: { currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false },
      activePage: 'sales',
      error: 'Failed to load sales data',
    });
  }
};

const exportSalesReport = async (req, res) => {
  try {
    const format = req.query.format || 'excel';
    const filterType = req.query.filter || 'monthly';
    let startDate, endDate;

    const now = moment();
    switch (filterType) {
      case 'daily':
        startDate = now.startOf('day').toDate();
        endDate = now.endOf('day').toDate();
        break;
      case 'weekly':
        startDate = now.startOf('week').toDate();
        endDate = now.endOf('week').toDate();
        break;
      case 'monthly':
        startDate = now.startOf('month').toDate();
        endDate = now.endOf('month').toDate();
        break;
      case 'yearly':
        startDate = now.startOf('year').toDate();
        endDate = now.endOf('year').toDate();
        break;
      case 'custom':
        if (!req.query.startDate || !req.query.endDate) {
          return res.status(400).send('Start and end dates are required for custom filter');
        }
        startDate = moment(req.query.startDate).startOf('day').toDate();
        endDate = moment(req.query.endDate).endOf('day').toDate();
        if (startDate > endDate) {
          return res.status(400).send('Start date cannot be after end date');
        }
        break;
      default:
        startDate = now.startOf('month').toDate();
        endDate = now.endOf('month').toDate();
    }

    const filter = {
      status: 'Delivered',
      createdOn: { $gte: startDate, $lte: endDate },
    };

    const orders = await Order.find(filter)
      .sort({ createdOn: -1 })
      .populate({
        path: 'orderedItems.product',
        select: 'name brand images regularPrice salePrice',
      })
      .lean();

    const processedOrders = orders.map((order) => {
      order.customerName =
        order.address?.name ||
        'Customer #' + (order.orderId || order._id.toString().slice(-4));
      order.orderedItems = order.orderedItems?.filter((item) => item.product) || [];
      return order;
    });

    const timestamp = moment().format('YYYYMMDD-HHmmss');
    const filename = `sales-report-${timestamp}`;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MobileHub';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Sales Report', {
        properties: { tabColor: { argb: '4F81BD' } },
      });

      worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 15 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Products', key: 'products', width: 40 },
        { header: 'Coupon Applied', key: 'couponApplied', width: 15 },
        { header: 'Offer Applied', key: 'offerApplied', width: 15 },
        { header: 'Total Amount', key: 'amount', width: 15 },
        { header: 'Payment Method', key: 'payment', width: 20 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 12 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      processedOrders.forEach((order) => {
        let productNames = order.orderedItems
          ?.map((item) => (item.product?.name ? `${item.product.name} (${item.quantity || 1})` : ''))
          .filter((name) => name)
          .join(', ') || 'N/A';

        worksheet.addRow({
          orderId: order.orderId || order._id.toString(),
          date: moment(order.createdOn || order.createdAt || new Date()).format('YYYY-MM-DD'),
          customer: order.customerName || 'Customer',
          products: productNames,
          couponApplied: order.couponDiscount > 0 ? 'True' : 'False',
          offerApplied: order.offerDiscount > 0 ? 'True' : 'False',
          amount: '₹' + (order.finalAmount || 0).toLocaleString(),
          payment: order.paymentMethod || 'Cash on Delivery',
        });
      });

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
        }
        row.height = 25;
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
      doc.pipe(res);

      doc.fontSize(20).text('Sales Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, { align: 'center' });
      doc.moveDown(2);

      const tableTop = 150;
      const tableLeft = 50;
      const colWidth = 80;

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Order ID', tableLeft, tableTop);
      doc.text('Date', tableLeft + colWidth, tableTop);
      doc.text('Customer', tableLeft + colWidth * 2, tableTop);
      doc.text('Coupon', tableLeft + colWidth * 3, tableTop);
      doc.text('Offer', tableLeft + colWidth * 4, tableTop);
      doc.text('Amount', tableLeft + colWidth * 5, tableTop);
      doc.moveDown();

      let currentY = tableTop + 25;
      doc.fontSize(10).font('Helvetica');

      processedOrders.forEach((order) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        doc.text(order.orderId || order._id.toString().slice(-6), tableLeft, currentY);
        doc.text(moment(order.createdOn).format('YYYY-MM-DD'), tableLeft + colWidth, currentY);
        doc.text(order.customerName, tableLeft + colWidth * 2, currentY);
        doc.text(order.couponDiscount > 0 ? 'True' : 'False', tableLeft + colWidth * 3, currentY);
        doc.text(order.offerDiscount > 0 ? 'True' : 'False', tableLeft + colWidth * 4, currentY);
        doc.text(`₹${(order.finalAmount || 0).toLocaleString()}`, tableLeft + colWidth * 5, currentY);

        currentY += 20;

        if (order.orderedItems?.length > 0) {
          doc.fontSize(9).font('Helvetica-Oblique');
          doc.text('Products:', tableLeft + 20, currentY);
          currentY += 15;

          order.orderedItems.forEach((item) => {
            if (currentY > 700) {
              doc.addPage();
              currentY = 50;
            }
            doc.text(
              `- ${item.product?.name || 'Unknown'} (${item.quantity}) - ₹${(item.price || 0).toLocaleString()}`,
              tableLeft + 30,
              currentY
            );
            currentY += 15;
          });

          doc.fontSize(10).font('Helvetica');
        }

        currentY += 10;
        doc.moveTo(tableLeft, currentY).lineTo(tableLeft + colWidth * 6, currentY).stroke();
        currentY += 20;
      });

      doc.end();
    } else {
      res.status(400).send('Invalid export format. Use "excel" or "pdf".');
    }
  } catch (error) {
    console.error('Error exporting sales report:', error);
    res.status(500).send('Error generating export file.');
  }
};

module.exports = {
  loadSalesReport,
  exportSalesReport,
};