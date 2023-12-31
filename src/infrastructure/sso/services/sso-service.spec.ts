import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

import {
  SSOUserInfoFailedResponse,
  SSOUserInfoSuccessResponse,
} from '@infrastructure/sso/contracts/sso-user-info.response';
import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SSOService } from './sso.service';

describe('SSOService Unit Tests', () => {
  let ssoService: SSOService;
  let configService: ConfigService;
  let httpService: HttpService;

  const authUrl = 'https://abc.com/auth';

  beforeEach(() => {
    configService = new ConfigService();
    httpService = new HttpService();
    ssoService = new SSOService(configService, httpService);
    ssoService['_auth_url'] = authUrl;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserInfo', () => {
    const bearerToken = 'valid_token';

    it('should return SSOUserInfoSuccessResponse if the request is successful', async () => {
      const responseMock: AxiosResponse<SSOUserInfoSuccessResponse> = {
        data: { sub: '123', email_verified: true, preferred_username: 'abc' },
        status: HttpStatus.OK,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest
        .spyOn(httpService, 'post')
        .mockImplementationOnce(() => of(responseMock));

      const result = await ssoService.getUserInfo(bearerToken);

      expect(result).toEqual(responseMock.data);
      expect(httpService.post).toHaveBeenCalledWith(
        `${authUrl}/userinfo`,
        {},
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      );
    });

    it('should return SSOUserInfoFailedResponse if the request returns UNAUTHORIZED status', async () => {
      const responseMock: AxiosResponse<SSOUserInfoFailedResponse> = {
        data: {
          error: 'invalid_token',
          error_description: 'Token verification failed',
        },
        status: HttpStatus.UNAUTHORIZED,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'post').mockReturnValueOnce(
        throwError(() => {
          return { response: responseMock };
        }),
      );

      jest.spyOn(Logger, 'error').mockImplementation();

      const result = await ssoService.getUserInfo(bearerToken);

      expect(result).toEqual(responseMock.data);
      expect(Logger.error).toHaveBeenCalledWith(
        'Invalid Token: Authorization failed at SSO service',
        responseMock,
      );
    });

    it('should throw InternalServerErrorException if the request fails with other error status', async () => {
      const responseMock: AxiosResponse = {
        data: {},
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => responseMock));

      jest.spyOn(Logger, 'error').mockImplementation();

      await expect(ssoService.getUserInfo(bearerToken)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(Logger.error).toHaveBeenCalledWith(
        'Unexpected error during SSO service request',
        responseMock,
      );
    });

    it('should throw BadGatewayException when the SSO server is unavailable', async () => {
      const errorMock: AxiosError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        config: {} as any,
        request: {},
        response: undefined,
        isAxiosError: true,
        toJSON: () => {
          return {};
        },
        name: '',
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => errorMock));

      jest.spyOn(Logger, 'error').mockImplementation();

      await expect(ssoService.getUserInfo(bearerToken)).rejects.toThrow(
        BadGatewayException,
      );
      expect(Logger.error).toHaveBeenCalledWith(
        'Unavailable SSO Server: Connection refused',
      );
    });

    it('should throw InternalServerErrorException for other unexpected authorization errors', async () => {
      const errorMock: Error = new Error('Testable Unexpected error');

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => errorMock));

      await expect(ssoService.getUserInfo(bearerToken)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
