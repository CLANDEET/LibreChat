import { ThemeSelector } from '@librechat/client';
import { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { BKL_APP_TITLE, BKL_TAGLINE } from '~/components/Bkl/brand';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize('com_auth_error_login_server')}</ErrorMessage>
        </div>
      );
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>
            {localize('com_auth_error_invalid_reset_token')}{' '}
            <a className="font-semibold text-gray-800 hover:underline dark:text-gray-200" href="/forgot-password">
              {localize('com_auth_click_here')}
            </a>{' '}
            {localize('com_auth_to_try_again')}
          </ErrorMessage>
        </div>
      );
    } else if (error != null && error) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize(error)}</ErrorMessage>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-white dark:bg-gray-900">
      <Banner />
      <BlinkAnimation active={isFetching}>
        {/* BKL Prism 로그인 락업. 법인 마크(teal 글자·투명 배경)는 그대로 두고
            서비스명 Prism 만 스펙트럼으로 얹는다 — 브랜드 정의의 워드마크가
            `BKL`(본문색) + `Prism`(그라디언트) 구성이라 로고가 앞의 BKL 을
            대신한다. 아래 스펙트럼 선은 이름의 유래(백색광→스펙트럼)를
            한 줄로 보여주는 유일한 장식이다. */}
        <div className="mt-8 flex w-full flex-col items-center gap-3">
          <div className="flex h-12 items-end gap-2.5">
            <img
              src="assets/bkl-logo-brand.png"
              className="h-full w-auto object-contain"
              alt={localize('com_ui_logo', { 0: BKL_APP_TITLE })}
            />
            <span
              aria-hidden="true"
              className="prism-spectrum-text pb-0.5 text-3xl font-semibold leading-none tracking-tight"
            >
              Prism
            </span>
          </div>
          <hr className="prism-rule w-40 max-w-[70vw]" aria-hidden="true" />
          <p className="text-sm text-text-secondary">{BKL_TAGLINE}</p>
        </div>
      </BlinkAnimation>
      <DisplayError />
      <div className="absolute bottom-0 left-0 md:m-4">
        <ThemeSelector />
      </div>

      <main className="flex flex-grow items-center justify-center">
        {/* BKL: max-w-md(28rem)에서 제목이 2줄로 꺾여 max-w-lg 로 확장 */}
        <div className="w-authPageWidth overflow-hidden bg-white px-6 py-4 dark:bg-gray-900 sm:max-w-lg sm:rounded-lg">
          {/* BKL: 모바일 폭에서 '…환영합니/다' 줄꺾임 방지 — 작은 화면은 2xl,
              단어 중간이 아닌 어절 단위로만 줄바꿈(break-keep) */}
          {!hasStartupConfigError && !isFetching && header && (
            <h1
              className="mb-4 break-keep text-center text-2xl font-semibold text-black dark:text-white sm:text-3xl"
              style={{ userSelect: 'none' }}
            >
              {header}
            </h1>
          )}
          {children}
          {!pathname.includes('2fa') &&
            (pathname.includes('login') || pathname.includes('register')) && (
              <SocialLoginRender startupConfig={startupConfig} />
            )}
        </div>
      </main>
      <Footer startupConfig={startupConfig} />
    </div>
  );
}

export default AuthLayout;
