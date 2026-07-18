import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service';
import { parsePaginationQuery, buildPaginationResponse } from '@/utils/pagination';
import { toCSV, respondCSV } from '@/utils/export';

export class FinanceController {
  constructor(private financeService: FinanceService) {}

  getGlobalFeeMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.financeService.getGlobalMatrix();
      return res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  saveFeeMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data } = req.body;
      if (!data) return res.status(400).json({ success: false, message: "Missing fee matrix payload." });
      await this.financeService.replaceGlobalMatrix(data);
      return res.status(200).json({ success: true, message: 'Fee matrices updated successfully.' });
    } catch (error) { next(error); }
  };

  // P2-13: Added pagination to section ledger endpoint.
  // Previously returned ALL payment collections for a section
  // with no limit — unbounded as payments accumulate.
  getSectionLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sectionId } = req.params;
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const history = await this.financeService.getInflowLedgerBySection(sectionId, skip, limit);
      const total = await this.financeService.countCollectionsBySection(sectionId);
      return res.status(200).json(buildPaginationResponse(history, total, page, limit));
    } catch (error) { next(error); }
  };

  commitInflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.financeService.processInflowCollection(req.body);
      return res.status(201).json({ success: true, data: record });
    } catch (error) { next(error); }
  };

  getStudentsBySection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sectionId } = req.params;
      const students = await this.financeService.getStudentsBySection(sectionId);
      return res.status(200).json({ success: true, data: students });
    } catch (error) { next(error); }
  };

  generateInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sectionId } = req.body;
      if (!sectionId) return res.status(400).json({ success: false, message: "Missing sectionId payload." });
      const result = await this.financeService.generateInvoicesForSection(sectionId);
      return res.status(201).json({ success: true, message: result.message, totalAmount: result.totalAmount });
    } catch (error) { next(error); }
  };

  getLedgers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const { data, total } = await this.financeService.getPaginatedLedgers(skip, limit);

      if (req.query.format === "csv") {
        const allData = await this.financeService.getAllLedgers();
        return respondCSV(res, toCSV(allData), "ledgers");
      }

      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) { next(error); }
  };

  createLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.financeService.createLedger(req.body);
      return res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getPayroll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const { data, total } = await this.financeService.getPaginatedPayroll(skip, limit);

      if (req.query.format === "csv") {
        const allData = await this.financeService.getCombinedPayroll();
        return respondCSV(res, toCSV(allData), "payroll");
      }

      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) { next(error); }
  };

  disbursePayroll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: "Missing payroll record ID." });
      await this.financeService.disbursePayroll(id);
      const data = await this.financeService.getCombinedPayroll();
      const ledgers = await this.financeService.getAllLedgers();
      return res.status(200).json({ success: true, data: { payroll: data, ledgers } });
    } catch (error) { next(error); }
  };
}
