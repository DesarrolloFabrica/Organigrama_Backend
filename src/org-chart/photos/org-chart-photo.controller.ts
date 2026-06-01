import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getAuthSessionFromRequest } from '../../auth/auth-request.util';
import type { AuthenticatedSessionContext } from '../../auth/types/authenticated-session.context';
import { getPhotoCacheTtlMs } from './photo.config';
import { OrgChartPhotoService } from './org-chart-photo.service';

@Controller('org-chart')
export class OrgChartPhotoController {
  constructor(private readonly orgChartPhotoService: OrgChartPhotoService) {}

  @Get('photos/:personId')
  async getPhoto(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const payload = await this.orgChartPhotoService.getPhotoPayload(
        personId,
        extractSessionContext(req),
      );

      const maxAgeSeconds = Math.floor(getPhotoCacheTtlMs() / 1000);

      res.setHeader('Content-Type', payload.contentType);
      res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}`);
      res.setHeader('X-Photo-Source', payload.source);
      res.status(200).send(payload.bytes);
    } catch (err) {
      if (err instanceof NotFoundException) {
        res.status(404).end();
        return;
      }
      throw err;
    }
  }
}

function extractSessionContext(
  req: Request,
): AuthenticatedSessionContext | undefined {
  return getAuthSessionFromRequest(req);
}
