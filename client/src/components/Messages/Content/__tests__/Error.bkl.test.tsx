/**
 * 오류 메시지 유형화 (2026-11-24): raw `502 Bad Gateway` / 내부 메시지 대신
 * 한글 안내 + 오류 코드 + 요청 ID. LibreChat 자체 코드표(JSON) 경로는 그대로.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import Error from '../Error';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('Error — BKL 유형화', () => {
  it('마커가 있는 스트림 오류 → 한글 안내 + 요청 ID, 영문 원문은 어디에도 없음', () => {
    render(
      <Error text="An error occurred while processing the request: upstream 502 Bad Gateway [BKL:SERVICE_UNAVAILABLE:req_42]" />,
    );
    const box = screen.getByTestId('bkl-error-notice');
    expect(box).toHaveAttribute('data-code', 'SERVICE_UNAVAILABLE');
    expect(screen.getByText('서비스 일시 중단')).toBeInTheDocument();
    expect(screen.getByTestId('bkl-error-rid')).toHaveTextContent('req_42');
    expect(screen.queryByText(/An error occurred while processing/)).toBeNull();
    expect(screen.queryByText(/502 Bad Gateway/)).toBeNull();
    expect(screen.queryByText('자세히')).toBeNull();
  });

  it('봉투의 detail 은 렌더에 쓰지 않는다 (5xx 원문 비노출 계약)', () => {
    render(
      <Error
        text={JSON.stringify({
          error: {
            code: 'EMBEDDING_UNAVAILABLE',
            message: '검색 엔진 일시 오류입니다. [BKL:EMBEDDING_UNAVAILABLE:rid-5]',
            request_id: 'rid-5',
            retryable: true,
          },
          detail: 'models/qwen3-embedding is not found for API version v1beta',
        })}
      />,
    );
    expect(screen.getByTestId('bkl-error-notice')).toHaveAttribute(
      'data-code',
      'EMBEDDING_UNAVAILABLE',
    );
    expect(screen.getByTestId('bkl-error-rid')).toHaveTextContent('rid-5');
    expect(screen.queryByText(/qwen3/)).toBeNull();
  });

  it('마커 없는 raw 505 도 한글로 매핑된다', () => {
    render(
      <Error text="An error occurred while processing the request: 505 HTTP Version Not Supported" />,
    );
    expect(screen.getByTestId('bkl-error-notice')).toHaveAttribute(
      'data-code',
      'SERVICE_UNAVAILABLE',
    );
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it('bkl-api HTTP 봉투 JSON 도 코드로 매핑된다', () => {
    render(
      <Error
        text={JSON.stringify({
          error: { code: 'FORBIDDEN', message: '권한 없음', request_id: 'rid-7', retryable: false },
          detail: 'forbidden',
        })}
      />,
    );
    expect(screen.getByTestId('bkl-error-notice')).toHaveAttribute('data-code', 'FORBIDDEN');
    expect(screen.getByTestId('bkl-error-rid')).toHaveTextContent('rid-7');
  });

  it('LibreChat 자체 코드표(JSON) 는 기존 경로 유지', () => {
    render(<Error text={JSON.stringify({ type: 'concurrent', limit: 1 })} />);
    expect(screen.getByText(/Only 1 message at a time/)).toBeInTheDocument();
    expect(screen.queryByTestId('bkl-error-notice')).toBeNull();
  });
});
