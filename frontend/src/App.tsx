import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  LinearProgress,
  Stack,
  Toolbar,
  Typography,
  Card,
  CardContent,
  CardActions,
} from '@mui/material'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import FilterListIcon from '@mui/icons-material/FilterList'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const MotionCard = motion(Card)

const filters = ['全部', '進行中', '已完成'] as const
type Filter = (typeof filters)[number]

function App() {
  const [activeFilter, setActiveFilter] = useState<Filter>('全部')
  const [loading, setLoading] = useState(false)

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: {
            main: '#6366f1',
          },
          background: {
            default: '#020617',
            paper: '#020617',
          },
        },
        typography: {
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        shape: {
          borderRadius: 18,
        },
      }),
    [],
  )

  const handleReload = () => {
    if (loading) return
    setLoading(true)
    setTimeout(() => setLoading(false), 900)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Box
        sx={{
          minHeight: '100vh',
          bgcolor:
            'radial-gradient(circle at top, rgba(56,189,248,0.15), transparent 55%), radial-gradient(circle at top right, rgba(129,140,248,0.25), transparent 60%), #020617',
          color: 'text.primary',
        }}
      >
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
            background:
              'linear-gradient(to bottom, rgba(15,23,42,0.95), rgba(15,23,42,0.7), transparent)',
          }}
        >
          <Toolbar sx={{ maxWidth: 1120, mx: 'auto', width: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} flex={1}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(129,140,248,0.2)',
                  boxShadow: '0 0 0 1px rgba(129,140,248,0.5)',
                }}
              >
                <DesignServicesIcon
                  sx={{ fontSize: 18, color: 'primary.main' }}
                />
              </Box>
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, letterSpacing: 0.4 }}
                >
                  2D → 3D 設計面板
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', letterSpacing: 0.3 }}
                >
                  React 互動式管理介面
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                sx={{
                  borderRadius: 999,
                  textTransform: 'none',
                  borderColor: 'rgba(148,163,184,0.5)',
                  color: 'rgba(248,250,252,0.9)',
                  '&:hover': {
                    borderColor: 'primary.light',
                    bgcolor: 'rgba(129,140,248,0.12)',
                  },
                }}
                startIcon={<FilterListIcon sx={{ fontSize: 18 }} />}
              >
                篩選配置
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container
          maxWidth="lg"
          sx={{
            py: { xs: 4, md: 6 },
            px: { xs: 2.5, md: 3 },
          }}
        >
          <Stack spacing={4}>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  mb: 1,
                }}
              >
                設計任務總覽
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(148,163,184,0.9)' }}
              >
                即時檢視由 PHP API 產生的設計任務，並透過互動卡片快速掌握狀態。
              </Typography>
            </Box>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                alignItems="center"
              >
                {filters.map((filter) => (
                  <Chip
                    key={filter}
                    label={filter}
                    clickable
                    color={activeFilter === filter ? 'primary' : 'default'}
                    onClick={() => setActiveFilter(filter)}
                    sx={{
                      borderRadius: 999,
                      px: 0.5,
                      bgcolor:
                        activeFilter === filter
                          ? 'rgba(129,140,248,0.22)'
                          : 'rgba(15,23,42,0.6)',
                      border:
                        activeFilter === filter
                          ? '1px solid rgba(129,140,248,0.8)'
                          : '1px solid rgba(148,163,184,0.35)',
                      color:
                        activeFilter === filter
                          ? '#e5e7ff'
                          : 'rgba(226,232,240,0.85)',
                      fontSize: 13,
                    }}
                  />
                ))}
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(148,163,184,0.95)' }}
                >
                  當前篩選：
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ color: 'primary.light', fontWeight: 600, ml: 0.5 }}
                  >
                    {activeFilter}
                  </Typography>
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleReload}
                  startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: 999,
                    textTransform: 'none',
                    px: 2.2,
                    py: 0.7,
                    boxShadow:
                      '0 18px 45px rgba(79,70,229,0.45), 0 0 0 1px rgba(129,140,248,0.4)',
                  }}
                >
                  模擬重新載入
                </Button>
              </Stack>
            </Stack>

            {loading && (
              <Box sx={{ position: 'relative' }}>
                <LinearProgress
                  sx={{
                    height: 3,
                    borderRadius: 999,
                    bgcolor: 'rgba(30,64,175,0.3)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 999,
                      bgcolor: 'primary.main',
                    },
                  }}
                />
              </Box>
            )}

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              alignItems="stretch"
            >
              <MotionCard
                whileHover={{
                  y: -6,
                  boxShadow:
                    '0 24px 60px rgba(15,23,42,0.88), 0 0 0 1px rgba(148,163,184,0.7)',
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                sx={{
                  flex: 1,
                  bgcolor: 'rgba(15,23,42,0.96)',
                  borderRadius: 4,
                  border: '1px solid rgba(148,163,184,0.6)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <CardContent sx={{ p: 3.2 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={2}
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          color: 'rgba(148,163,184,0.9)',
                          letterSpacing: 2,
                        }}
                      >
                        最新設計
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ mt: 0.5, fontWeight: 600, letterSpacing: 0.2 }}
                      >
                        字體輪廓轉 3D
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label="進行中"
                      sx={{
                        borderRadius: 999,
                        bgcolor: 'rgba(251,191,36,0.12)',
                        color: '#fde68a',
                        border: '1px solid rgba(251,191,36,0.4)',
                        fontSize: 11,
                        height: 24,
                      }}
                    />
                  </Stack>

                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1.8,
                      color: 'rgba(148,163,184,0.95)',
                      lineHeight: 1.7,
                    }}
                  >
                    由後端 PHP 產生的 SVG / STL 檔案會即時顯示在右側畫布，這裡可以快速檢視每個設計任務
                    的進度與關鍵參數。
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 3.2, pb: 2.6 }}>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      textTransform: 'none',
                      color: 'primary.light',
                      borderRadius: 999,
                      px: 1.6,
                      '&:hover': {
                        bgcolor: 'rgba(79,70,229,0.16)',
                      },
                    }}
                  >
                    檢視設計詳細
                  </Button>
                </CardActions>
              </MotionCard>

              <MotionCard
                whileHover={{
                  y: -6,
                  boxShadow:
                    '0 24px 58px rgba(15,23,42,0.9), 0 0 0 1px rgba(56,189,248,0.6)',
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                sx={{
                  flex: 1,
                  bgcolor:
                    'radial-gradient(circle at top, rgba(56,189,248,0.12), transparent 60%), rgba(15,23,42,0.98)',
                  borderRadius: 4,
                  border: '1px solid rgba(56,189,248,0.65)',
                  backdropFilter: 'blur(18px)',
                  overflow: 'hidden',
                }}
              >
                <CardContent sx={{ p: 3.2 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: 'rgba(148,163,184,0.9)',
                      letterSpacing: 2,
                    }}
                  >
                    即時互動
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ mt: 0.5, fontWeight: 600, letterSpacing: 0.3 }}
                  >
                    互動式 3D 預覽面板
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1.8,
                      color: 'rgba(148,163,184,0.95)',
                      lineHeight: 1.7,
                    }}
                  >
                    你可以在這裡接上既有的 Three.js 或 WebGL 畫布，把 PHP
                    產生的 3D 檔案載入進來。
                    也可以用這個卡片作為「設計詳細頁」入口。
                  </Typography>
                </CardContent>
              </MotionCard>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  )
}

export default App
